-- Disposable layer: openWarehouse runs this file whenever these tables are missing,
-- and transform refills every row from warehouse history, so deleting them loses nothing.
DROP TABLE IF EXISTS tenant_directory_entries;
DROP TABLE IF EXISTS tenant_urls;
DROP TABLE IF EXISTS tenant_capabilities;

CREATE TABLE tenant_directory_entries (
  id                     INTEGER PRIMARY KEY,
  vendor                 TEXT NOT NULL,
  fhir_version           TEXT NOT NULL DEFAULT '',
  tenant_id              TEXT NOT NULL,
  name                   TEXT,
  url                    TEXT NOT NULL,
  managing_organization  TEXT,
  last_seen_in_directory TEXT NOT NULL,
  UNIQUE (vendor, fhir_version, tenant_id)
);

CREATE INDEX idx_directory_entries_url
  ON tenant_directory_entries (vendor, fhir_version, url);

CREATE TABLE tenant_urls (
  vendor       TEXT NOT NULL,
  fhir_version TEXT NOT NULL DEFAULT '',
  tenant_id    TEXT NOT NULL,
  url          TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE (vendor, fhir_version, tenant_id, url)
);

CREATE TABLE tenant_capabilities (
  id                    INTEGER PRIMARY KEY,
  vendor                TEXT NOT NULL,
  fhir_version          TEXT NOT NULL DEFAULT '',
  url                   TEXT NOT NULL,
  authorize_url         TEXT,
  token_url             TEXT,
  register_url          TEXT,
  classification        TEXT NOT NULL,
  UNIQUE (vendor, fhir_version, url)
);
