CREATE TABLE raw_documents (
  id                   INTEGER PRIMARY KEY,
  vendor               TEXT NOT NULL,
  fhir_version         TEXT NOT NULL DEFAULT '',
  doc_type             TEXT NOT NULL,
  url                  TEXT NOT NULL,
  raw                  TEXT,
  first_seen_at        TEXT NOT NULL,
  last_refreshed       TEXT,
  last_sync_attempt    TEXT,
  last_sync_was_error  INTEGER NOT NULL DEFAULT 0,
  last_error           TEXT,
  UNIQUE (vendor, fhir_version, doc_type, url)
);

CREATE TABLE fetch_runs (
  id           INTEGER PRIMARY KEY,
  vendor       TEXT NOT NULL,
  fhir_version TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL,
  failed       INTEGER
);

-- The latest tenant count transform parsed, read by the status table.
CREATE TABLE directory_counts (
  vendor           TEXT NOT NULL,
  fhir_version     TEXT NOT NULL DEFAULT '',
  seen_at          TEXT NOT NULL,
  tenant_count     INTEGER NOT NULL,
  PRIMARY KEY (vendor, fhir_version)
);

-- Every distinct directory body ever fetched; the never-forget memory.
CREATE TABLE directory_snapshots (
  id           INTEGER PRIMARY KEY,
  vendor       TEXT NOT NULL,
  fhir_version TEXT NOT NULL DEFAULT '',
  fetched_at   TEXT NOT NULL,
  body         TEXT NOT NULL,
  UNIQUE (vendor, fhir_version, fetched_at)
);

-- Feeds the publish history in status, so it survives a derived-table rebuild.
CREATE TABLE publications (
  id           INTEGER PRIMARY KEY,
  published_at TEXT NOT NULL,
  row_count    INTEGER NOT NULL
);
