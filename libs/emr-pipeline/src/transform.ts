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
import { getRow } from '@mere/tenant-db';
import * as snapshots from './db/repository/directory-snapshots';

interface ClassifiedCapability {
  classification: CapabilityClassification;
  authorizeUrl?: string;
  tokenUrl?: string;
  registerUrl?: string;
}

/**
 * Reads one CapabilityStatement body into the auth urls and classification publish needs.
 *
 * Never throws: an unreadable body becomes a classified row so the failure is queryable
 * rather than fatal.
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
    for (const table of [
      'tenant_directory_entries',
      'tenant_urls',
      'tenant_capabilities',
    ]) {
      db.prepare(
        `DELETE FROM ${table} WHERE vendor = ? AND fhir_version = ?`,
      ).run(vendor, fhirVersion);
    }

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

    const insertEntry = db.prepare(
      `INSERT INTO tenant_directory_entries
         (vendor, fhir_version, tenant_id, name, url, managing_organization,
          last_seen_in_directory)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const [tenantId, tenant] of merged) {
      insertEntry.run(
        vendor,
        fhirVersion,
        tenantId,
        tenant.name ?? null,
        tenant.url,
        tenant.managingOrganization ?? null,
        tenant.lastSeen,
      );
      counts.directoryEntries++;
    }

    const insertUrl = db.prepare(
      `INSERT INTO tenant_urls (vendor, fhir_version, tenant_id, url, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const seenUrl of seenUrls.values()) {
      insertUrl.run(
        vendor,
        fhirVersion,
        seenUrl.tenantId,
        seenUrl.url,
        seenUrl.lastSeenAt,
      );
    }

    const insertCapability = db.prepare(
      `INSERT INTO tenant_capabilities
         (vendor, fhir_version, url, authorize_url,
          token_url, register_url, classification)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (vendor, fhir_version, url) DO NOTHING`,
    );
    const selectCapability = db.prepare(
      `SELECT body FROM capability_downloads
       WHERE vendor = ? AND fhir_version = ? AND url = ? AND body IS NOT NULL`,
    );
    for (const seenUrl of seenUrls.values()) {
      const capabilityUrl = adapter.capabilityUrl({
        tenantId: seenUrl.tenantId,
        url: seenUrl.url,
      });
      if (!capabilityUrl) continue;
      const document = getRow<{ body: string }>(selectCapability, [
        vendor,
        fhirVersion,
        capabilityUrl,
      ]);
      if (!document) continue;

      const classified = classifyCapability(document.body);
      const inserted = insertCapability.run(
        vendor,
        fhirVersion,
        seenUrl.url,
        classified.authorizeUrl ?? null,
        classified.tokenUrl ?? null,
        classified.registerUrl ?? null,
        classified.classification,
      );
      if (Number(inserted.changes) === 0) continue;
      if (classified.classification === 'unparseable') counts.unparseable++;
      counts.capabilities++;
    }

    if (latest.seenAt !== '') {
      db.prepare(
        `INSERT INTO directory_counts
           (vendor, fhir_version, seen_at, tenant_count)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (vendor, fhir_version) DO UPDATE SET
           seen_at = excluded.seen_at,
           tenant_count = excluded.tenant_count`,
      ).run(vendor, fhirVersion, latest.seenAt, latest.tenantCount);
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
