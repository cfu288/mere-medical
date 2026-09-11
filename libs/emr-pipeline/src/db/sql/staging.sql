-- Disposable layer: openWarehouse runs this file whenever these tables are missing,
-- and transform refills every row from warehouse history, so deleting them loses nothing.
DROP TABLE IF EXISTS tenant_names;
DROP TABLE IF EXISTS tenant_listings;
DROP TABLE IF EXISTS url_smart_security;

CREATE TABLE tenant_names (
  vendor                TEXT NOT NULL,
  fhir_version          TEXT NOT NULL DEFAULT '',
  tenant_id             TEXT NOT NULL,
  name                  TEXT,
  managing_organization TEXT,
  PRIMARY KEY (vendor, fhir_version, tenant_id)
);

CREATE TABLE tenant_listings (
  id           INTEGER PRIMARY KEY,
  vendor       TEXT NOT NULL,
  fhir_version TEXT NOT NULL DEFAULT '',
  tenant_id    TEXT NOT NULL,
  url          TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE (vendor, fhir_version, tenant_id, url)
);

CREATE TABLE url_smart_security (
  vendor         TEXT NOT NULL,
  fhir_version   TEXT NOT NULL DEFAULT '',
  url            TEXT NOT NULL,
  authorize_url  TEXT,
  token_url      TEXT,
  register_url   TEXT,
  classification TEXT NOT NULL,
  PRIMARY KEY (vendor, fhir_version, url)
);
