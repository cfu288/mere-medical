-- Durable layer. openWarehouse creates these tables once on a brand-new file.

-- One row per metadata url a directory ever listed, holding its last good
-- body and last attempt. Extract writes it, transform reads the bodies,
-- status reads the dates.
CREATE TABLE capability_downloads (
  id            INTEGER PRIMARY KEY,
  vendor        TEXT NOT NULL,
  fhir_version  TEXT NOT NULL DEFAULT '',
  url           TEXT NOT NULL,
  body          TEXT,
  downloaded_at TEXT,
  attempted_at  TEXT,
  failed        INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  UNIQUE (vendor, fhir_version, url)
);

-- Each vendor's last directory fetch date and error. The only record of a
-- failed fetch.
CREATE TABLE directory_fetches (
  vendor       TEXT NOT NULL,
  fhir_version TEXT NOT NULL DEFAULT '',
  attempted_at TEXT NOT NULL,
  error        TEXT,
  PRIMARY KEY (vendor, fhir_version)
);

-- One row per finished extract run with its failure count. Status renders
-- the failing column from the last two.
CREATE TABLE fetch_runs (
  id           INTEGER PRIMARY KEY,
  vendor       TEXT NOT NULL,
  fhir_version TEXT NOT NULL DEFAULT '',
  failed       INTEGER NOT NULL
);

-- How many tenants each directory listed when transform last parsed it.
-- Status renders the endpoints column from it.
CREATE TABLE directory_counts (
  vendor           TEXT NOT NULL,
  fhir_version     TEXT NOT NULL DEFAULT '',
  seen_at          TEXT NOT NULL,
  tenant_count     INTEGER NOT NULL,
  PRIMARY KEY (vendor, fhir_version)
);

-- Every distinct directory body ever fetched. This history is how the
-- pipeline remembers delisted tenants.
CREATE TABLE vendor_tenant_directory_snapshots (
  id           INTEGER PRIMARY KEY,
  vendor       TEXT NOT NULL,
  fhir_version TEXT NOT NULL DEFAULT '',
  fetched_at   TEXT NOT NULL,
  body         TEXT NOT NULL,
  UNIQUE (vendor, fhir_version, fetched_at)
);

-- When tenants.db was written and with how many rows. Status lists the
-- recent ones.
CREATE TABLE publications (
  id           INTEGER PRIMARY KEY,
  published_at TEXT NOT NULL,
  row_count    INTEGER NOT NULL
);
