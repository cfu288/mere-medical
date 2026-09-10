import type { DatabaseSync } from 'node:sqlite';
import { setTimeout as sleep } from 'node:timers/promises';
import type { FhirVersion, Vendor } from '@mere/shared';
import { adapterFor } from './adapters';
import { parseBundle } from './adapters/schemas';
import { DirectoryEntry, FHIR_ACCEPT, HttpStatusError } from './adapters/types';
import * as downloads from './db/repository/capability-downloads';
import * as runs from './db/repository/fetch-runs';
import * as snapshots from './db/repository/directory-snapshots';

function isHttpsUrl(value: string): boolean {
  return URL.parse(value)?.protocol === 'https:';
}

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
  concurrency: number;
  hostConcurrency: number;
  hostFailureLimit: number;
  timeoutMs: number;
  directoryTimeoutMs: number;
  retries: number;
  batchSize: number;
  now: () => string;
  log: (message: string) => void;
}

export const DEFAULT_EXTRACT_OPTIONS = {
  concurrency: 8,
  hostConcurrency: 4,
  hostFailureLimit: 25,
  timeoutMs: 20_000,
  directoryTimeoutMs: 300_000,
  retries: 3,
  batchSize: 200,
} as const;

interface ExtractResult {
  status: 'ok' | 'failed';
}

type DirectoryCheck = { ok: true } | { ok: false; reason: string };

/** Rejects a directory that contradicts itself: empty, or a declared total its entries do not match. */
export function checkDirectory(
  tenantCount: number,
  bundleEntryCount: number,
  declaredTotal: number | undefined,
): DirectoryCheck {
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

class HostUnreachableError extends Error {
  constructor(host: string, failureLimit: number) {
    super(
      `Host ${host} failed ${failureLimit} times with no success; remaining documents skipped`,
    );
    this.name = 'HostUnreachableError';
  }
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  options: Pick<ExtractOptions, 'timeoutMs' | 'retries'>,
): Promise<{ body: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    if (attempt > 0) {
      const backoff = 2 ** (attempt - 1) * 500;
      await sleep(backoff + Math.random() * backoff);
    }
    let response: Response | null = null;
    let body = '';
    try {
      response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      body = await response.text();
    } catch (error) {
      lastError = error;
      continue;
    }

    if (response.status >= 500) {
      lastError = new HttpStatusError(response.status);
      continue;
    }
    if (!response.ok) {
      throw new HttpStatusError(response.status);
    }
    return { body };
  }
  throw lastError;
}

function hostOf(url: string): string {
  return URL.parse(url)?.host ?? url;
}

interface PoolTask<T> {
  host: string;
  run: () => Promise<T>;
}

interface PoolOptions<T> {
  concurrency: number;
  hostConcurrency: number;
  /** 0 disables giving up on a host. */
  hostFailureLimit: number;
  failed: (result: T) => boolean;
  skipped: (host: string) => T;
}

/**
 * Runs tasks under a global cap, a per-host cap, and a per-host give-up rule.
 *
 * A host that blackholes costs the full timeout on every request; without the give-up
 * rule one dead host in a large catalog stalls a run for hours.
 */
export async function runPool<T>(
  tasks: PoolTask<T>[],
  options: PoolOptions<T>,
  onResult: (result: T, index: number) => void,
): Promise<Map<string, number>> {
  const queue = tasks.map((task, index) => ({ task, index }));
  const inFlight = new Map<string, number>();
  const failures = new Map<string, number>();
  const successes = new Set<string>();
  const abandoned = new Map<string, number>();

  const givenUp = (host: string) =>
    options.hostFailureLimit > 0 &&
    !successes.has(host) &&
    (failures.get(host) ?? 0) >= options.hostFailureLimit;

  const busy = (host: string) =>
    (inFlight.get(host) ?? 0) >= options.hostConcurrency;

  async function worker(): Promise<void> {
    for (;;) {
      const next = queue.findIndex((item) => !busy(item.task.host));
      if (next === -1) {
        if (queue.length === 0) return;
        await sleep(HOST_WAIT_MS);
        continue;
      }
      const [item] = queue.splice(next, 1);
      const host = item.task.host;

      if (givenUp(host)) {
        abandoned.set(host, (abandoned.get(host) ?? 0) + 1);
        onResult(options.skipped(host), item.index);
        continue;
      }

      inFlight.set(host, (inFlight.get(host) ?? 0) + 1);
      try {
        const result = await item.task.run();
        if (options.failed(result)) {
          failures.set(host, (failures.get(host) ?? 0) + 1);
        } else {
          successes.add(host);
        }
        onResult(result, item.index);
      } finally {
        inFlight.set(host, (inFlight.get(host) ?? 1) - 1);
      }
    }
  }

  const workers = Math.max(1, Math.min(options.concurrency, tasks.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return abandoned;
}

const HOST_WAIT_MS = 25;

type CapabilityOutcome =
  | { kind: 'ok'; id: number; body: string }
  | { kind: 'error'; id: number; error: unknown }
  | { kind: 'skipped'; host: string };

type RecordedOutcome = Exclude<CapabilityOutcome, { kind: 'skipped' }>;

export async function extract(
  db: DatabaseSync,
  options: ExtractOptions,
): Promise<ExtractResult> {
  const { vendor, fhirVersion, log } = options;
  const adapter = adapterFor(vendor);
  const runId = runs.startRun(db, vendor, fhirVersion);
  const counts = { fetched: 0, failed: 0 };

  const source = adapter.directory(fhirVersion);
  if (!source) {
    runs.finishRun(db, runId, counts.failed);
    throw new Error(`${vendor} publishes no ${fhirVersion} directory`);
  }

  const rejectDirectory = (message: string): ExtractResult => {
    snapshots.recordAttempt(db, vendor, fhirVersion, options.now(), message);
    counts.failed++;
    runs.finishRun(db, runId, counts.failed);
    log(`${vendor} ${fhirVersion}: ${message}`);
    return { status: 'failed' };
  };

  let fetched: { body: string };
  try {
    fetched = await source.fetch(
      AbortSignal.timeout(options.directoryTimeoutMs),
    );
  } catch (error) {
    return rejectDirectory(`directory fetch failed - ${error}`);
  }

  const parsed = parseBundle(fetched.body);
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
  if (
    !snapshots.appendSnapshot(
      db,
      vendor,
      fhirVersion,
      options.now(),
      fetched.body,
    )
  ) {
    log(
      `${vendor} ${fhirVersion}: directory unchanged; updated the date on its saved copy`,
    );
  }

  try {
    log(`${vendor} ${fhirVersion}: directory holds ${entries.length} tenants`);
    const capabilityUrls = new Set<string>();
    for (const entry of entries) {
      const url = adapter.capabilityUrl(entry);
      if (url) capabilityUrls.add(url);
    }

    db.exec('BEGIN');
    try {
      for (const url of capabilityUrls) {
        downloads.addUrl(db, { vendor, fhirVersion, url }, options.now());
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

    const buffer: RecordedOutcome[] = [];
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

    const abandoned = await runPool<CapabilityOutcome>(
      fetchable.map((row) => ({
        host: hostOf(row.url),
        run: async (): Promise<CapabilityOutcome> => {
          try {
            const result = await fetchWithRetry(
              row.url,
              capabilityHeaders,
              options,
            );
            return { kind: 'ok', id: row.id, ...result };
          } catch (error) {
            return { kind: 'error', id: row.id, error };
          }
        },
      })),
      {
        concurrency: options.concurrency,
        hostConcurrency: options.hostConcurrency,
        hostFailureLimit: options.hostFailureLimit,
        failed: (result) =>
          result.kind === 'error' &&
          (!(result.error instanceof HttpStatusError) ||
            result.error.status >= 500),
        skipped: (host) => ({ kind: 'skipped', host }),
      },
      (outcome, index) => {
        buffer.push(
          outcome.kind === 'skipped'
            ? {
                kind: 'error',
                id: fetchable[index].id,
                error: new HostUnreachableError(
                  outcome.host,
                  options.hostFailureLimit,
                ),
              }
            : outcome,
        );
        if (buffer.length >= options.batchSize) flush();
      },
    );
    flush();
    for (const [host, count] of abandoned) {
      log(
        `${vendor} ${fhirVersion}: gave up on ${host} after ${count} skipped documents`,
      );
    }

    runs.finishRun(db, runId, counts.failed);
    log(
      `${vendor} ${fhirVersion}: ${counts.fetched} fetched, ${counts.failed} failed`,
    );
    return { status: 'ok' };
  } catch (error) {
    try {
      runs.finishRun(db, runId, counts.failed);
    } catch {
      // Preserve the triggering error when even the status write cannot get a lock.
    }
    throw error;
  }
}
