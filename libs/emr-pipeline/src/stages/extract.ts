import { setTimeout as sleep } from 'node:timers/promises';
import type { FhirVersion, Vendor } from '@mere/shared';
import { adapterFor } from '../adapters';
import type { Warehouse } from '../db/open';
import { parseBundle } from '../adapters/schemas';
import { DirectoryEntry, FHIR_ACCEPT } from '../adapters/types';
import * as downloads from '../db/repository/capability-downloads';
import * as runs from '../db/repository/fetch-runs';
import * as vendorTenantDirectory from '../db/repository/vendor-tenant-directory-snapshots';
import { classifyCapability } from './transform';

const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;
const RETRIES = 3;

/** Checks if a url uses https and returns a boolean. */
function isHttpsUrl(value: string): boolean {
  return URL.parse(value)?.protocol === 'https:';
}

/** Checks if a string is valid JSON and returns a boolean. */
function isValidJson(body: string): boolean {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

interface ExtractResult {
  status: 'ok' | 'failed';
}

/**
 * Checks the tenant directory is valid before saving.
 * Vendors sometimes answer 200 despite invalid counts or data. Returns not-ok with
 * the reason.
 */
export function checkTenantDirectoryCounts(
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

/**
 * Fetches one metadata url and returns its body text, retrying errors
 */
async function fetchWithExponentialBackoff(
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

/**
 * Using a queue + workers to download concurrently. A worker starts
 * the next url as soon as its current one finishes, vs batches which wait for the slowest job.
 *
 * @param tasks - One fetch per metadata url, each resolving to an outcome.
 * @param onResult - Called with each outcome as it lands, in completion order.
 * @returns Resolves once every outcome is handed over.
 * @example
 * await runWorkerPool(
 *   fetchable.map((row) => () => fetchOutcome(row)),
 *   (outcome) => recordInWarehouse(outcome),
 * );
 */
async function runWorkerPool(
  tasks: (() => Promise<CapabilityOutcome>)[],
  onResult: (result: CapabilityOutcome) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      await onResult(await tasks[next++]());
    }
  }
  const workers = Math.min(CONCURRENCY, Math.max(tasks.length, 1));
  const settled = await Promise.allSettled(
    Array.from({ length: workers }, worker),
  );
  for (const result of settled) {
    if (result.status === 'rejected') throw result.reason;
  }
}

/**
 * Fetches one vendor and version's directory containing all tenants, saves a snapshot
 * of it in the database, and then for each tenant in the directory, downloads the capability
 * statement document to save in the db. Rejected directories are not saved,
 * and a stored usable capability body is never overwritten by an unusable one.
 *
 * @returns `{ status: 'ok' }` when the directory was crawled, even if some capability
 *   downloads failed, or `{ status: 'failed' }` when the directory itself was
 *   rejected.
 * @example
 * const db = openWarehouse('libs/emr-pipeline/data/warehouse.db');
 * const result = await extract(db, 'epic', 'R4');
 *
 * A run like this logs progress and resolves to `{ status: 'ok' }`:
 *
 *   epic R4: directory holds 820 tenants
 *   epic R4: 815 fetched, 5 failed
 */
export async function startCapabilityStatementExtractionForVendor(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): Promise<ExtractResult> {
  const adapter = adapterFor(vendor);
  const counts = { fetched: 0, failed: 0 };

  const source = adapter.directory(fhirVersion);
  if (!source) {
    throw new Error(`${vendor} publishes no ${fhirVersion} directory`);
  }

  const rejectDirectory = async (message: string): Promise<ExtractResult> => {
    await vendorTenantDirectory.recordFetchAttempt(
      db,
      vendor,
      fhirVersion,
      new Date().toISOString(),
      message,
    );
    await runs.record(db, vendor, fhirVersion, 1);
    console.log(`${vendor} ${fhirVersion}: ${message}`);
    return { status: 'failed' };
  };

  let body: string;
  try {
    body = await source.fetch();
  } catch (error) {
    return rejectDirectory(`directory fetch failed - ${error}`);
  }

  const parsed = parseBundle(body);
  if (!parsed.ok) {
    return rejectDirectory(`directory body rejected - ${parsed.error}`);
  }
  const bundle = parsed.bundle;

  const entries: DirectoryEntry[] = adapter.parseDirectory(bundle);
  const check = checkTenantDirectoryCounts(
    entries.length,
    bundle.entry.length,
    bundle.total,
  );
  if (!check.ok) {
    return rejectDirectory(`directory rejected: ${check.reason}`);
  }
  await vendorTenantDirectory.recordFetchAttempt(
    db,
    vendor,
    fhirVersion,
    new Date().toISOString(),
    null,
  );
  if (
    !(await vendorTenantDirectory.saveSnapshot(
      db,
      vendor,
      fhirVersion,
      new Date().toISOString(),
      body,
    ))
  ) {
    console.log(
      `${vendor} ${fhirVersion}: directory unchanged; updated the date on its latest snapshot`,
    );
  }

  console.log(
    `${vendor} ${fhirVersion}: directory holds ${entries.length} tenants`,
  );
  const metadataUrls = new Set<string>();
  for (const entry of entries) {
    const url = adapter.metadataUrl(entry);
    if (url) metadataUrls.add(url);
  }

  await db
    .transaction()
    .execute((trx) =>
      downloads.addUrls(trx, vendor, fhirVersion, [...metadataUrls]),
    );

  const documents = (
    await downloads.selectForDownload(db, vendor, fhirVersion)
  ).filter((row) => metadataUrls.has(row.url));
  const insecure = documents.filter((row) => !isHttpsUrl(row.url));
  for (const row of insecure) {
    await downloads.recordFailure(db, {
      id: row.id,
      error: new Error(`refusing to fetch non-https url ${row.url}`),
      now: new Date().toISOString(),
    });
    counts.failed++;
  }
  if (insecure.length > 0) {
    console.log(
      `${vendor} ${fhirVersion}: refused ${insecure.length} non-https metadata urls`,
    );
  }
  const fetchable = documents.filter((row) => isHttpsUrl(row.url));
  const capabilityHeaders = {
    Accept: FHIR_ACCEPT,
    ...adapter.capabilityHeaders?.(),
  };
  console.log(
    `${vendor} ${fhirVersion}: ${fetchable.length} capability documents to fetch`,
  );

  await runWorkerPool(
    fetchable.map((row) => async (): Promise<CapabilityOutcome> => {
      try {
        const result = await fetchWithExponentialBackoff(
          row.url,
          capabilityHeaders,
        );
        return { kind: 'ok', id: row.id, ...result };
      } catch (error) {
        return { kind: 'error', id: row.id, error };
      }
    }),
    async (outcome) => {
      if (outcome.kind === 'ok' && isValidJson(outcome.body)) {
        const classification = classifyCapability(outcome.body).classification;
        const stored =
          classification === 'usable'
            ? null
            : await downloads.findById(db, outcome.id);
        const keepStored =
          stored?.body != null &&
          classifyCapability(stored.body).classification === 'usable';
        if (keepStored) {
          await downloads.recordFailure(db, {
            id: outcome.id,
            error: new Error(
              `endpoint answered with an unusable capability (${classification}), keeping the last usable body`,
            ),
            now: new Date().toISOString(),
          });
          counts.failed++;
        } else {
          await downloads.recordSuccess(db, {
            id: outcome.id,
            body: outcome.body,
            now: new Date().toISOString(),
          });
          counts.fetched++;
        }
      } else if (outcome.kind === 'ok') {
        await downloads.recordFailure(db, {
          id: outcome.id,
          error: new Error('endpoint answered 200 with a non-JSON body'),
          now: new Date().toISOString(),
        });
        counts.failed++;
      } else {
        await downloads.recordFailure(db, {
          id: outcome.id,
          error: outcome.error,
          now: new Date().toISOString(),
        });
        counts.failed++;
      }
    },
  );

  await runs.record(db, vendor, fhirVersion, counts.failed);
  console.log(
    `${vendor} ${fhirVersion}: ${counts.fetched} fetched, ${counts.failed} failed`,
  );
  return { status: 'ok' };
}
