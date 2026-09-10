import type { DatabaseSync } from 'node:sqlite';
import type { DocType, FhirVersion, Vendor } from '@mere/shared';
import { allRows, getRow } from '@mere/tenant-db';

interface RawDocumentKey {
  vendor: Vendor;
  fhirVersion: FhirVersion;
  docType: DocType;
  url: string;
}

export interface RawDocumentRow extends RawDocumentKey {
  id: number;
  raw: string | null;
  lastRefreshed: string | null;
}

interface RawDocumentSqlRow {
  id: number;
  vendor: string;
  fhir_version: string;
  doc_type: string;
  url: string;
  raw: string | null;
  last_refreshed: string | null;
}

function toRow(row: RawDocumentSqlRow): RawDocumentRow {
  return {
    id: row.id,
    vendor: row.vendor as Vendor,
    fhirVersion: row.fhir_version as FhirVersion,
    docType: row.doc_type as DocType,
    url: row.url,
    raw: row.raw,
    lastRefreshed: row.last_refreshed,
  };
}

/** Registers a document as tracked without fetching it, and returns its id. */
export function trackDocument(
  db: DatabaseSync,
  key: RawDocumentKey,
  now: string,
): number {
  db.prepare(
    `INSERT INTO raw_documents (vendor, fhir_version, doc_type, url, first_seen_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (vendor, fhir_version, doc_type, url) DO NOTHING`,
  ).run(key.vendor, key.fhirVersion, key.docType, key.url, now);

  const row = getRow<{ id: number }>(
    db.prepare(
      `SELECT id FROM raw_documents
       WHERE vendor = ? AND fhir_version = ? AND doc_type = ? AND url = ?`,
    ),
    [key.vendor, key.fhirVersion, key.docType, key.url],
  );

  if (!row) {
    throw new Error(`Failed to track ${key.vendor} ${key.docType} ${key.url}`);
  }
  return row.id;
}

export function findByKey(
  db: DatabaseSync,
  key: RawDocumentKey,
): RawDocumentRow | null {
  const row = getRow<RawDocumentSqlRow>(
    db.prepare(
      `SELECT * FROM raw_documents
       WHERE vendor = ? AND fhir_version = ? AND doc_type = ? AND url = ?`,
    ),
    [key.vendor, key.fhirVersion, key.docType, key.url],
  );
  return row ? toRow(row) : null;
}

export function findById(db: DatabaseSync, id: number): RawDocumentRow | null {
  const row = getRow<RawDocumentSqlRow>(
    db.prepare('SELECT * FROM raw_documents WHERE id = ?'),
    [id],
  );
  return row ? toRow(row) : null;
}

interface FetchSuccess {
  id: number;
  body: string;
  now: string;
}

/** Writes a body verbatim and clears the error state. */
export function recordSuccess(db: DatabaseSync, result: FetchSuccess): void {
  db.prepare(
    `UPDATE raw_documents
     SET raw                 = :body,
         last_refreshed      = :now,
         last_sync_attempt   = :now,
         last_sync_was_error = 0,
         last_error          = NULL
     WHERE id = :id`,
  ).run({
    id: result.id,
    body: result.body,
    now: result.now,
  });
}

interface FetchFailure {
  id: number;
  error: unknown;
  now: string;
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
  return JSON.stringify({ name: 'Unknown', message: String(error) });
}

/** Records a failed fetch without touching `raw`, so a good body survives an outage. */
export function recordFailure(db: DatabaseSync, failure: FetchFailure): void {
  db.prepare(
    `UPDATE raw_documents
     SET last_sync_attempt   = :now,
         last_sync_was_error = 1,
         last_error          = :error
     WHERE id = :id`,
  ).run({
    id: failure.id,
    now: failure.now,
    error: serializeError(failure.error),
  });
}

interface WorklistQuery {
  vendor: Vendor;
  fhirVersion: FhirVersion;
  docType: DocType;
}

/**
 * Every tracked document for one vendor and version, never-downloaded rows first.
 *
 * Extract downloads this whole list every run; a stored copy is crash insurance,
 * never a reason to skip the fetch.
 */
export function selectWorklist(
  db: DatabaseSync,
  query: WorklistQuery,
): RawDocumentRow[] {
  const rows = allRows<RawDocumentSqlRow>(
    db.prepare(
      `SELECT * FROM raw_documents
       WHERE vendor = :vendor AND fhir_version = :fhirVersion AND doc_type = :docType
       ORDER BY (raw IS NULL) DESC, last_refreshed ASC`,
    ),
    {
      vendor: query.vendor,
      fhirVersion: query.fhirVersion,
      docType: query.docType,
    },
  );
  return rows.map(toRow);
}
