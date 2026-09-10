import type { DatabaseSync } from 'node:sqlite';
import type {
  CapabilityClassification,
  FhirVersion,
  Vendor,
} from '@mere/shared';
import { allRows } from '@mere/tenant-db';

/** One tenant merged from every snapshot: latest url and seen date, last non-empty name. */
export interface DirectoryEntryRow {
  tenantId: string;
  name: string | undefined;
  url: string;
  managingOrganization: string | undefined;
  lastSeen: string;
}

/** One url a tenant was ever listed at, and the last snapshot that listed it there. */
export interface TenantUrlRow {
  tenantId: string;
  url: string;
  lastSeenAt: string;
}

export interface CapabilityRow {
  url: string;
  authorizeUrl: string | null;
  tokenUrl: string | null;
  registerUrl: string | null;
  classification: CapabilityClassification;
}

function replace(
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

export function replaceEntries(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  entries: DirectoryEntryRow[],
): void {
  replace(db, 'tenant_directory_entries', vendor, fhirVersion);
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

export function replaceUrls(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  urls: TenantUrlRow[],
): void {
  replace(db, 'tenant_urls', vendor, fhirVersion);
  const insert = db.prepare(
    `INSERT INTO tenant_urls (vendor, fhir_version, tenant_id, url, last_seen_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const url of urls) {
    insert.run(vendor, fhirVersion, url.tenantId, url.url, url.lastSeenAt);
  }
}

export function replaceCapabilities(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  capabilities: CapabilityRow[],
): void {
  replace(db, 'tenant_capabilities', vendor, fhirVersion);
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

/** A tenant ready to ship: named (athena aside), with its best usable auth urls. */
export interface PublishableTenant {
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

/** Auth comes from the current url's usable capability, else the most recently seen one. */
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
