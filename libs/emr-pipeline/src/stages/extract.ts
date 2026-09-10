import type { DatabaseSync } from 'node:sqlite';
import { setTimeout as sleep } from 'node:timers/promises';
import type { FhirVersion, Vendor } from '@mere/shared';
import { adapterFor } from '../adapters';
import { parseBundle } from '../adapters/schemas';
import { DirectoryEntry, FHIR_ACCEPT } from '../adapters/types';
import * as downloads from '../db/repository/capability-downloads';
import * as runs from '../db/repository/fetch-runs';
import * as snapshots from '../db/repository/directory-snapshots';

const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;
const DIRECTORY_TIMEOUT_MS = 300_000;
const RETRIES = 3;
const BATCH_SIZE = 200;

/** True for an https url, the only kind the crawl fetches. */
function isHttpsUrl(value: string): boolean {
  return URL.parse(value)?.protocol === 'https:';
}

/** Tells a real FHIR body from an error page served with status 200. */
function isJson(body: string): boolean {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

interface ExtractOptions {
  vendor: Vendor;
  fhirVersion: FhirVersion;
  now: () => string;
  log: (message: string) => void;
}

interface ExtractResult {
  status: 'ok' | 'failed';
}

/** Rejects a directory that is empty or whose declared total does not match its entries. */
export function checkDirectory(
  tenantCount: number,
  bundleEntryCount: number,
  declaredTotal: number | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (tenantCount === 0) {
    return { ok: false, reason: 'directory yielded no tenants' };
  }
  if (declaredTotal !== undefined && declaredTotal !== bundleEntryCount) {
    return {
      ok: false,
      reason: `directory declares total ${declaredTotal} but holds ${bundleEntryCount} entries`,
    };
  }
  return { ok: true };
}

/** Fetches one url with a timeout, retrying network errors and 5xx answers. Any other bad status throws. */
async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
): Promise<{ body: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = 2 ** (attempt - 1) * 500;
      await sleep(backoff + Math.random() * backoff);
    }
    let response: Response | null = null;
    let body = '';
    try {
      response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      body = await response.text();
    } catch (error) {
      lastError = error;
      continue;
    }

    if (response.status >= 500) {
      lastError = new Error(`HTTP ${response.status}`);
      continue;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return { body };
  }
  throw lastError;
}

type CapabilityOutcome =
  | { kind: 'ok'; id: number; body: string }
  | { kind: 'error'; id: number; error: unknown };

/** Runs the tasks a fixed number at a time. When one fails, it waits for the rest to finish before rethrowing. */
async function runPool<T>(
  tasks: (() => Promise<T>)[],
  onResult: (result: T) => void,
): Promise<void> {
  let next = 0;
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      onResult(await tasks[next++]());
    }
  }
  const workers = Math.max(1, Math.min(CONCURRENCY, tasks.length));
  const settled = await Promise.allSettled(
    Array.from({ length: workers }, worker),
  );
  for (const result of settled) {
    if (result.status === 'rejected') throw result.reason;
  }
}

/**
 * Fetches one vendor and version's directory, saves it as a snapshot, and downloads
 * every capability document it lists into the warehouse.
 *
 * A directory that cannot be fetched or fails its checks returns `failed` instead of
 * throwing. Individual capability download failures are recorded and never abort a run.
 */
export async function extract(
  db: DatabaseSync,
  options: ExtractOptions,
): Promise<ExtractResult> {
  const { vendor, fhirVersion, log } = options;
  const adapter = adapterFor(vendor);
  const counts = { fetched: 0, failed: 0 };

  const source = adapter.directory(fhirVersion);
  if (!source) {
    throw new Error(`${vendor} publishes no ${fhirVersion} directory`);
  }

  const rejectDirectory = (message: string): ExtractResult => {
    snapshots.recordAttempt(db, vendor, fhirVersion, options.now(), message);
    runs.record(db, vendor, fhirVersion, 1);
    log(`${vendor} ${fhirVersion}: ${message}`);
    return { status: 'failed' };
  };

  let body: string;
  try {
    body = await source.fetch(AbortSignal.timeout(DIRECTORY_TIMEOUT_MS));
  } catch (error) {
    return rejectDirectory(`directory fetch failed - ${error}`);
  }

  const parsed = parseBundle(body);
  if (!parsed.ok) {
    return rejectDirectory(`directory body rejected - ${parsed.error}`);
  }
  const bundle = parsed.bundle;

  const entries: DirectoryEntry[] = adapter.parseDirectory(bundle);
  const check = checkDirectory(
    entries.length,
    bundle.entry.length,
    bundle.total,
  );
  if (!check.ok) {
    return rejectDirectory(`directory rejected: ${check.reason}`);
  }
  snapshots.recordAttempt(db, vendor, fhirVersion, options.now(), null);
  if (!snapshots.appendSnapshot(db, vendor, fhirVersion, options.now(), body)) {
    log(
      `${vendor} ${fhirVersion}: directory unchanged; updated the date on its saved copy`,
    );
  }

  log(`${vendor} ${fhirVersion}: directory holds ${entries.length} tenants`);
  const capabilityUrls = new Set<string>();
  for (const entry of entries) {
    const url = adapter.capabilityUrl(entry);
    if (url) capabilityUrls.add(url);
  }

  db.exec('BEGIN');
  try {
    for (const url of capabilityUrls) {
      downloads.addUrl(db, { vendor, fhirVersion, url });
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const documents = downloads
    .selectForDownload(db, { vendor, fhirVersion })
    .filter((row) => capabilityUrls.has(row.url));
  const insecure = documents.filter((row) => !isHttpsUrl(row.url));
  for (const row of insecure) {
    downloads.recordFailure(db, {
      id: row.id,
      error: new Error(`refusing to fetch non-https url ${row.url}`),
      now: options.now(),
    });
    counts.failed++;
  }
  if (insecure.length > 0) {
    log(
      `${vendor} ${fhirVersion}: refused ${insecure.length} non-https capability urls`,
    );
  }
  const fetchable = documents.filter((row) => isHttpsUrl(row.url));
  const capabilityHeaders = {
    Accept: FHIR_ACCEPT,
    ...adapter.capabilityHeaders?.(),
  };
  log(
    `${vendor} ${fhirVersion}: ${fetchable.length} capability documents to fetch`,
  );

  const buffer: CapabilityOutcome[] = [];
  const flush = () => {
    if (buffer.length === 0) return;
    db.exec('BEGIN');
    try {
      for (const outcome of buffer) {
        if (outcome.kind === 'ok' && isJson(outcome.body)) {
          downloads.recordSuccess(db, {
            id: outcome.id,
            body: outcome.body,
            now: options.now(),
          });
          counts.fetched++;
        } else if (outcome.kind === 'ok') {
          downloads.recordFailure(db, {
            id: outcome.id,
            error: new Error('endpoint answered 200 with a non-JSON body'),
            now: options.now(),
          });
          counts.failed++;
        } else {
          downloads.recordFailure(db, {
            id: outcome.id,
            error: outcome.error,
            now: options.now(),
          });
          counts.failed++;
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    buffer.length = 0;
  };

  await runPool<CapabilityOutcome>(
    fetchable.map((row) => async (): Promise<CapabilityOutcome> => {
      try {
        const result = await fetchWithRetry(row.url, capabilityHeaders);
        return { kind: 'ok', id: row.id, ...result };
      } catch (error) {
        return { kind: 'error', id: row.id, error };
      }
    }),
    (outcome) => {
      buffer.push(outcome);
      if (buffer.length >= BATCH_SIZE) flush();
    },
  );
  flush();

  runs.record(db, vendor, fhirVersion, counts.failed);
  log(
    `${vendor} ${fhirVersion}: ${counts.fetched} fetched, ${counts.failed} failed`,
  );
  return { status: 'ok' };
}
