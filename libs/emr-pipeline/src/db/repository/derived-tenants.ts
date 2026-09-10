/**
 * Owns the disposable tables `tenant_directory_entries`, `tenant_urls`, and
 * `tenant_capabilities`. Transform rebuilds them from the saved directory copies in
 * `directory_snapshots`, and publish reads `listPublishable` to write `tenants.db`.
 * They exist so publish is one query over merged rows instead of rereading the whole
 * history itself.
 */
import type { DatabaseSync } from 'node:sqlite';
import type {
  CapabilityClassification,
  FhirVersion,
  Vendor,
} from '@mere/shared';
import { allRows } from '@mere/tenant-db';

/** One tenant summarized across every saved directory copy. It keeps the url and date from the newest copy that listed the tenant, and the last name the vendor ever gave it. */
interface DirectoryEntryRow {
  tenantId: string;
  name: string | undefined;
  url: string;
  managingOrganization: string | undefined;
  lastSeen: string;
}

/** Records that a tenant was once listed at this url, and the date of the newest directory copy that listed it there. */
interface TenantUrlRow {
  tenantId: string;
  url: string;
  lastSeenAt: string;
}

/** The SMART auth urls read out of one url's downloaded CapabilityStatement. The classification says whether they are complete enough to log in with, and `listPublishable` keeps only `usable` rows. */
export interface CapabilityRow {
  url: string;
  authorizeUrl: string | null;
  tokenUrl: string | null;
  registerUrl: string | null;
  classification: CapabilityClassification;
}

/** Deletes one vendor and version's rows from the given table. */
function clearRows(
  db: DatabaseSync,
  table: string,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): void {
  db.prepare(`DELETE FROM ${table} WHERE vendor = ? AND fhir_version = ?`).run(
    vendor,
    fhirVersion,
  );
}

/** Deletes and rewrites one vendor and version's tenant rows. Transform calls it after rereading every saved directory copy. */
export function replaceEntries(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  entries: DirectoryEntryRow[],
): void {
  clearRows(db, 'tenant_directory_entries', vendor, fhirVersion);
  const insert = db.prepare(
    `INSERT INTO tenant_directory_entries
       (vendor, fhir_version, tenant_id, name, url, managing_organization,
        last_seen_in_directory)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const entry of entries) {
    insert.run(
      vendor,
      fhirVersion,
      entry.tenantId,
      entry.name ?? null,
      entry.url,
      entry.managingOrganization ?? null,
      entry.lastSeen,
    );
  }
}

/** Deletes and rewrites which urls each tenant was ever listed at. Transform calls it in the same pass as `replaceEntries`. */
export function replaceUrls(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  urls: TenantUrlRow[],
): void {
  clearRows(db, 'tenant_urls', vendor, fhirVersion);
  const insert = db.prepare(
    `INSERT INTO tenant_urls (vendor, fhir_version, tenant_id, url, last_seen_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const url of urls) {
    insert.run(vendor, fhirVersion, url.tenantId, url.url, url.lastSeenAt);
  }
}

/** Deletes and rewrites each url's `CapabilityRow`, the auth urls read from its downloaded CapabilityStatement. Transform calls it in the same pass as `replaceEntries`. */
export function replaceCapabilities(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  capabilities: CapabilityRow[],
): void {
  clearRows(db, 'tenant_capabilities', vendor, fhirVersion);
  const insert = db.prepare(
    `INSERT INTO tenant_capabilities
       (vendor, fhir_version, url, authorize_url, token_url, register_url,
        classification)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (vendor, fhir_version, url) DO NOTHING`,
  );
  for (const capability of capabilities) {
    insert.run(
      vendor,
      fhirVersion,
      capability.url,
      capability.authorizeUrl,
      capability.tokenUrl,
      capability.registerUrl,
      capability.classification,
    );
  }
}

/** A tenant ready to ship, named unless athena, with its best usable auth urls. */
interface PublishableTenant {
  tenant_id: string;
  vendor: string;
  fhir_version: string;
  name: string;
  url: string;
  token: string | null;
  authorize: string | null;
  register: string | null;
  managing_organization: string | null;
  searchable: number;
  last_seen_in_directory: string;
}

/**
 * Queries the three derived tables and then returns a list of every tenant that
 * belongs in `tenants.db`, each carrying auth urls from its current url's usable
 * CapabilityStatement, or else from the most recent of its urls that had one. This is
 * intended to be used by publish as the artifact's entire directory-sourced content.
 */
export function listPublishable(db: DatabaseSync): PublishableTenant[] {
  return allRows<PublishableTenant>(
    db.prepare(
      `WITH usable AS (
         SELECT u.vendor, u.fhir_version, u.tenant_id, u.url,
                c.token_url, c.authorize_url, c.register_url, u.last_seen_at
         FROM tenant_urls u
         JOIN tenant_capabilities c
           ON c.vendor = u.vendor AND c.fhir_version = u.fhir_version AND c.url = u.url
         WHERE c.classification = 'usable'
       ),
       best AS (
         SELECT d.id AS entry_id, s.token_url, s.authorize_url, s.register_url,
                ROW_NUMBER() OVER (
                  PARTITION BY d.id
                  ORDER BY (s.url = d.url) DESC, s.last_seen_at DESC
                ) AS rank
         FROM tenant_directory_entries d
         JOIN usable s
           ON s.vendor = d.vendor AND s.fhir_version = d.fhir_version
          AND s.tenant_id = d.tenant_id
       )
       SELECT d.tenant_id, d.vendor, d.fhir_version,
              coalesce(d.name, '') AS name, d.url,
              b.token_url AS token, b.authorize_url AS authorize,
              b.register_url AS register, d.managing_organization,
              CASE d.vendor WHEN 'athena' THEN 0 ELSE 1 END AS searchable,
              d.last_seen_in_directory
       FROM tenant_directory_entries d
       LEFT JOIN best b ON b.entry_id = d.id AND b.rank = 1
       WHERE CASE d.vendor
               WHEN 'athena' THEN 1
               ELSE trim(coalesce(d.name, '')) <> '' AND b.entry_id IS NOT NULL
             END
       ORDER BY d.vendor, d.fhir_version, d.tenant_id`,
    ),
  );
}
