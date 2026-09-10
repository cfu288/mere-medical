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

CREATE TABLE directory_fetches (
  vendor       TEXT NOT NULL,
  fhir_version TEXT NOT NULL DEFAULT '',
  attempted_at TEXT NOT NULL,
  error        TEXT,
  PRIMARY KEY (vendor, fhir_version)
);

CREATE TABLE fetch_runs (
  id           INTEGER PRIMARY KEY,
  vendor       TEXT NOT NULL,
  fhir_version TEXT NOT NULL DEFAULT '',
  failed       INTEGER NOT NULL
);

CREATE TABLE directory_counts (
  vendor           TEXT NOT NULL,
  fhir_version     TEXT NOT NULL DEFAULT '',
  seen_at          TEXT NOT NULL,
  tenant_count     INTEGER NOT NULL,
  PRIMARY KEY (vendor, fhir_version)
);

CREATE TABLE directory_snapshots (
  id           INTEGER PRIMARY KEY,
  vendor       TEXT NOT NULL,
  fhir_version TEXT NOT NULL DEFAULT '',
  fetched_at   TEXT NOT NULL,
  body         TEXT NOT NULL,
  UNIQUE (vendor, fhir_version, fetched_at)
);

CREATE TABLE publications (
  id           INTEGER PRIMARY KEY,
  published_at TEXT NOT NULL,
  row_count    INTEGER NOT NULL
);
