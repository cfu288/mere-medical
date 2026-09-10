/** Bump whenever `TENANT_DB_SCHEMA` changes. `openTenantDb` refuses any other value. */
export const TENANT_DB_USER_VERSION = 1;

export const TENANT_DB_SCHEMA = `
CREATE TABLE tenants (
  id                    INTEGER PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  vendor                TEXT NOT NULL,
  fhir_version          TEXT NOT NULL,
  name                  TEXT NOT NULL,
  url                   TEXT NOT NULL,
  token                 TEXT,
  authorize             TEXT,
  register              TEXT,
  managing_organization TEXT,
  source                TEXT NOT NULL,
  searchable            INTEGER NOT NULL,
  last_seen_in_directory TEXT NOT NULL,
  UNIQUE (vendor, fhir_version, tenant_id)
);

CREATE INDEX idx_tenants_vendor ON tenants (vendor, fhir_version, source);
CREATE INDEX idx_tenants_lookup ON tenants (vendor, tenant_id);

CREATE VIRTUAL TABLE tenants_fts USING fts5(
  name, managing_organization, content='tenants', content_rowid='id'
);
`;
