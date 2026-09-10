import type { DatabaseSync } from 'node:sqlite';
import type {
  CapabilityClassification,
  FhirVersion,
  Vendor,
} from '@mere/shared';
import { adapterFor } from './adapters';
import type { DirectoryEntry } from './adapters/types';
import {
  CapabilityStatement,
  capabilityStatementSchema,
  parseBundle,
  readSmartUris,
} from './adapters/schemas';
import * as snapshots from './db/repository/directory-snapshots';
import * as downloads from './db/repository/capability-downloads';
import * as derived from './db/repository/derived-tenants';
import * as directoryCounts from './db/repository/directory-counts';

interface ClassifiedCapability {
  classification: CapabilityClassification;
  authorizeUrl?: string;
  tokenUrl?: string;
  registerUrl?: string;
}

/**
 * Reads one CapabilityStatement body into its SMART auth urls plus a classification
 * saying whether they are usable, and if not, why. Never throws: an unreadable body
 * classifies as `unparseable`.
 */
export function classifyCapability(body: string): ClassifiedCapability {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { classification: 'unparseable' };
  }

  const parsed = capabilityStatementSchema.safeParse(json);
  if (!parsed.success) {
    return { classification: 'unparseable' };
  }

  const statement: CapabilityStatement = parsed.data;
  if (statement.resourceType === 'OperationOutcome') {
    return { classification: 'operation_outcome' };
  }

  const uris = readSmartUris(statement);
  if (!uris) {
    return { classification: 'no_security_block' };
  }

  const classified = {
    authorizeUrl: uris['authorize'],
    tokenUrl: uris['token'],
    registerUrl: uris['register'],
  };

  if (!classified.authorizeUrl) {
    return { ...classified, classification: 'missing_authorize' };
  }
  if (!classified.tokenUrl) {
    return { ...classified, classification: 'missing_token' };
  }
  return { ...classified, classification: 'usable' };
}

interface TransformOptions {
  vendor: Vendor;
  fhirVersion: FhirVersion;
  log: (message: string) => void;
}

interface TransformCounts {
  directoryEntries: number;
  capabilities: number;
  unparseable: number;
  duplicateTenantIds: number;
}

interface MergedTenant {
  name: string | undefined;
  managingOrganization: string | undefined;
  url: string;
  lastSeen: string;
}

/**
 * Folds one vendor and version's snapshot history into the derived tenant tables,
 * classifying each tenant's stored capability download, and returns counts of what it
 * wrote. A tenant id a snapshot lists at more than one url contributes nothing from
 * that snapshot; what earlier snapshots said about it still counts.
 */
export function transform(
  db: DatabaseSync,
  options: TransformOptions,
): TransformCounts {
  const { vendor, fhirVersion } = options;
  const adapter = adapterFor(vendor);
  const counts: TransformCounts = {
    directoryEntries: 0,
    capabilities: 0,
    unparseable: 0,
    duplicateTenantIds: 0,
  };

  const history = snapshots.listSnapshots(db, vendor, fhirVersion);
  if (history.length === 0) {
    options.log(
      `${vendor} ${fhirVersion}: no directory snapshots to transform`,
    );
    return counts;
  }

  db.exec('BEGIN');
  try {
    const merged = new Map<string, MergedTenant>();
    const seenUrls = new Map<
      string,
      { tenantId: string; url: string; lastSeenAt: string }
    >();
    let latest = { seenAt: '', tenantCount: 0 };

    for (const snapshot of history) {
      const parsed = parseBundle(snapshot.body);
      if (!parsed.ok) {
        options.log(
          `${vendor} ${fhirVersion}: snapshot ${snapshot.fetched_at} is unparseable, skipped`,
        );
        continue;
      }
      const entries = adapter.parseDirectory(parsed.bundle).map((entry) => ({
        ...entry,
        name: entry.name?.trim() || undefined,
        managingOrganization: entry.managingOrganization?.trim() || undefined,
      }));

      const byTenantId = Map.groupBy(entries, (entry) => entry.tenantId);
      const resolved: DirectoryEntry[] = [];
      const ambiguous: string[] = [];
      for (const [tenantId, group] of byTenantId) {
        if (new Set(group.map((entry) => entry.url)).size > 1) {
          ambiguous.push(tenantId);
          continue;
        }
        resolved.push(group[0]);
      }
      counts.duplicateTenantIds = ambiguous.length;
      if (ambiguous.length > 0) {
        options.log(
          `${vendor} ${fhirVersion}: snapshot ${snapshot.fetched_at} dropped ${ambiguous.length} tenant ids listed at multiple urls: ${ambiguous
            .slice(0, 5)
            .join(', ')}`,
        );
      }

      for (const entry of resolved) {
        const previous = merged.get(entry.tenantId);
        merged.set(entry.tenantId, {
          url: entry.url,
          lastSeen: snapshot.fetched_at,
          name: entry.name ?? previous?.name,
          managingOrganization:
            entry.managingOrganization ?? previous?.managingOrganization,
        });
        seenUrls.set(`${entry.tenantId}\n${entry.url}`, {
          tenantId: entry.tenantId,
          url: entry.url,
          lastSeenAt: snapshot.fetched_at,
        });
      }
      latest = { seenAt: snapshot.fetched_at, tenantCount: entries.length };
    }

    derived.replaceEntries(
      db,
      vendor,
      fhirVersion,
      [...merged.entries()].map(([tenantId, tenant]) => ({
        tenantId,
        name: tenant.name,
        url: tenant.url,
        managingOrganization: tenant.managingOrganization,
        lastSeen: tenant.lastSeen,
      })),
    );
    counts.directoryEntries = merged.size;

    derived.replaceUrls(db, vendor, fhirVersion, [...seenUrls.values()]);

    const capabilities: derived.CapabilityRow[] = [];
    const classifiedUrls = new Set<string>();
    for (const seenUrl of seenUrls.values()) {
      if (classifiedUrls.has(seenUrl.url)) continue;
      const capabilityUrl = adapter.capabilityUrl({
        tenantId: seenUrl.tenantId,
        url: seenUrl.url,
      });
      if (!capabilityUrl) continue;
      const download = downloads.findByUrl(db, {
        vendor,
        fhirVersion,
        url: capabilityUrl,
      });
      if (download?.body == null) continue;

      const classified = classifyCapability(download.body);
      classifiedUrls.add(seenUrl.url);
      capabilities.push({
        url: seenUrl.url,
        authorizeUrl: classified.authorizeUrl ?? null,
        tokenUrl: classified.tokenUrl ?? null,
        registerUrl: classified.registerUrl ?? null,
        classification: classified.classification,
      });
      if (classified.classification === 'unparseable') counts.unparseable++;
    }
    derived.replaceCapabilities(db, vendor, fhirVersion, capabilities);
    counts.capabilities = capabilities.length;

    if (latest.seenAt !== '') {
      directoryCounts.record(
        db,
        vendor,
        fhirVersion,
        latest.seenAt,
        latest.tenantCount,
      );
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  options.log(
    `${vendor} ${fhirVersion}: ${counts.directoryEntries} tenants, ${counts.capabilities} capabilities, ${counts.unparseable} unparseable` +
      (counts.duplicateTenantIds
        ? `, ${counts.duplicateTenantIds} ambiguous tenant ids in the latest snapshot`
        : ''),
  );
  return counts;
}
