/**
 * Owns the disposable tables `tenant_names`, `tenant_listings`, and
 * `url_capabilities`. Transform rebuilds them from the snapshots so publish
 * is one query instead of rereading history.
 */
import type { DatabaseSync } from 'node:sqlite';
import type {
  CapabilityClassification,
  FhirVersion,
  Vendor,
} from '@mere/shared';
import { allRows } from '@mere/tenant-db';

/**
 * One tenant as its vendor's directory has ever listed it: merged name, and
 * every url with the date of the newest snapshot listing it there. The
 * current listing is the url with the newest date, computed at query time.
 */
export interface TenantListing {
  tenantId: string;
  name?: string;
  managingOrganization?: string;
  urls: { url: string; lastSeenAt: string }[];
}

/**
 * One url's SMART auth urls and whether they are complete enough to log in
 * with. `listPublishable` keeps only `usable` rows.
 */
export interface UrlCapability {
  url: string;
  authorizeUrl: string | null;
  tokenUrl: string | null;
  registerUrl: string | null;
  classification: CapabilityClassification;
}

/**
 * Deletes and rewrites a vendor and version's whole tenant model in the
 * caller's transaction, always all three tables together.
 */
export function replace(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  listings: TenantListing[],
  capabilities: UrlCapability[],
): void {
  for (const table of ['tenant_names', 'tenant_listings', 'url_capabilities']) {
    db.prepare(
      `DELETE FROM ${table} WHERE vendor = ? AND fhir_version = ?`,
    ).run(vendor, fhirVersion);
  }

  const insertName = db.prepare(
    `INSERT INTO tenant_names
       (vendor, fhir_version, tenant_id, name, managing_organization)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const insertUrl = db.prepare(
    `INSERT INTO tenant_listings (vendor, fhir_version, tenant_id, url, last_seen_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const listing of listings) {
    insertName.run(
      vendor,
      fhirVersion,
      listing.tenantId,
      listing.name ?? null,
      listing.managingOrganization ?? null,
    );
    for (const seen of listing.urls) {
      insertUrl.run(
        vendor,
        fhirVersion,
        listing.tenantId,
        seen.url,
        seen.lastSeenAt,
      );
    }
  }

  const insertCapability = db.prepare(
    `INSERT INTO url_capabilities
       (vendor, fhir_version, url, authorize_url, token_url, register_url,
        classification)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (vendor, fhir_version, url) DO NOTHING`,
  );
  for (const capability of capabilities) {
    insertCapability.run(
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

/**
 * A tenant ready to ship, named unless athena, with its best usable auth urls.
 */
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
 * Returns every publishable tenant with auth urls from its current url's usable
 * CapabilityStatement, else its most recent usable one. Publish writes exactly
 * this list to the artifact. The current listing is the tenant's newest
 * `tenant_listings` row, ties broken by highest id.
 */
export function listPublishable(db: DatabaseSync): PublishableTenant[] {
  return allRows<PublishableTenant>(
    db.prepare(
      `WITH current AS (
         SELECT vendor, fhir_version, tenant_id, url, last_seen_at
         FROM (
           SELECT l.*, ROW_NUMBER() OVER (
             PARTITION BY l.vendor, l.fhir_version, l.tenant_id
             ORDER BY l.last_seen_at DESC, l.id DESC
           ) AS rn
           FROM tenant_listings l
         )
         WHERE rn = 1
       ),
       usable AS (
         SELECT l.vendor, l.fhir_version, l.tenant_id, l.url, l.last_seen_at,
                l.id, c.token_url, c.authorize_url, c.register_url
         FROM tenant_listings l
         JOIN url_capabilities c
           ON c.vendor = l.vendor AND c.fhir_version = l.fhir_version AND c.url = l.url
         WHERE c.classification = 'usable'
       ),
       best AS (
         SELECT u.vendor, u.fhir_version, u.tenant_id,
                u.token_url, u.authorize_url, u.register_url,
                ROW_NUMBER() OVER (
                  PARTITION BY u.vendor, u.fhir_version, u.tenant_id
                  ORDER BY (u.url = cur.url) DESC, u.last_seen_at DESC, u.id DESC
                ) AS rank
         FROM usable u
         JOIN current cur
           ON cur.vendor = u.vendor AND cur.fhir_version = u.fhir_version
          AND cur.tenant_id = u.tenant_id
       )
       SELECT cur.tenant_id, cur.vendor, cur.fhir_version,
              coalesce(n.name, '') AS name, cur.url,
              b.token_url AS token, b.authorize_url AS authorize,
              b.register_url AS register, n.managing_organization,
              CASE cur.vendor WHEN 'athena' THEN 0 ELSE 1 END AS searchable,
              cur.last_seen_at AS last_seen_in_directory
       FROM current cur
       LEFT JOIN tenant_names n
         ON n.vendor = cur.vendor AND n.fhir_version = cur.fhir_version
        AND n.tenant_id = cur.tenant_id
       LEFT JOIN best b
         ON b.vendor = cur.vendor AND b.fhir_version = cur.fhir_version
        AND b.tenant_id = cur.tenant_id AND b.rank = 1
       WHERE CASE cur.vendor
               WHEN 'athena' THEN 1
               ELSE trim(coalesce(n.name, '')) <> '' AND b.tenant_id IS NOT NULL
             END
       ORDER BY cur.vendor, cur.fhir_version, cur.tenant_id`,
    ),
  );
}
