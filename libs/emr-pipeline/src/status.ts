import type { DatabaseSync } from 'node:sqlite';
import { allRows, getRow } from '@mere/tenant-db';
import { ADAPTERS } from './adapters';

interface ObservationRow {
  tenant_count: number;
  last_observed_at: string;
}

interface PublicationRow {
  published_at: string;
  row_count: number;
}

function signed(n: number): string {
  return n < 0 ? String(n) : `+${n}`;
}

function failedCounts(db: DatabaseSync, vendor: string, version: string) {
  return allRows<{ failed: number | null }>(
    db.prepare(
      `SELECT failed FROM fetch_runs
       WHERE vendor = ? AND fhir_version = ? AND status = 'done'
       ORDER BY id DESC LIMIT 2`,
    ),
    [vendor, version],
  ).map((run) => run.failed);
}

export function formatStatus(db: DatabaseSync, now: string): string {
  const age = (ts: string): string => {
    const days = Math.floor((Date.parse(now) - Date.parse(ts)) / 86_400_000);
    return days < 1 ? 'today' : `${days}d ago`;
  };

  const line = (cells: [string, string, string, string, string, string]) =>
    [
      cells[0].padEnd(10),
      cells[1].padEnd(8),
      cells[2].padStart(9),
      cells[3].padStart(9),
      cells[4].padEnd(9),
      cells[5],
    ].join(' ');

  const lines = [
    line(['vendor', 'version', 'endpoints', 'failing', 'crawled', 'transform']),
  ];

  const vendors = Object.entries(ADAPTERS).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [vendor, adapter] of vendors) {
    for (const version of adapter.versions) {
      const observation = getRow<ObservationRow>(
        db.prepare(
          `SELECT tenant_count, last_observed_at FROM directory_observations
           WHERE vendor = ? AND fhir_version = ?`,
        ),
        [vendor, version],
      );
      const failing =
        getRow<{ n: number }>(
          db.prepare(
            `SELECT COUNT(*) AS n FROM raw_documents
             WHERE vendor = ? AND fhir_version = ? AND doc_type = 'capability'
               AND last_sync_was_error = 1`,
          ),
          [vendor, version],
        )?.n ?? 0;
      const crawled = getRow<{ newest: string | null }>(
        db.prepare(
          `SELECT MAX(last_refreshed) AS newest FROM raw_documents
           WHERE vendor = ? AND fhir_version = ?`,
        ),
        [vendor, version],
      )?.newest;
      const directoryBody = getRow<{ newest: string | null }>(
        db.prepare(
          `SELECT MAX(last_refreshed) AS newest FROM raw_documents
           WHERE vendor = ? AND fhir_version = ? AND doc_type = 'directory'
             AND raw IS NOT NULL`,
        ),
        [vendor, version],
      )?.newest;

      const [lastFailed, previousFailed] = failedCounts(db, vendor, version);
      const failingCell =
        lastFailed != null &&
        previousFailed != null &&
        lastFailed !== previousFailed
          ? `${failing} (${signed(lastFailed - previousFailed)})`
          : String(failing);

      const transform = directoryBody
        ? !observation || directoryBody > observation.last_observed_at
          ? 'BEHIND'
          : 'current'
        : observation
          ? 'current'
          : '-';

      lines.push(
        line([
          vendor,
          version,
          observation ? String(observation.tenant_count) : '-',
          failingCell,
          crawled ? age(crawled) : 'never',
          transform,
        ]),
      );
    }
  }

  const publications = allRows<PublicationRow>(
    db.prepare(
      `SELECT published_at, row_count FROM publications
       ORDER BY published_at DESC, id DESC LIMIT 6`,
    ),
  );
  lines.push('');
  if (publications.length === 0) {
    lines.push('published: never');
  } else {
    lines.push('publishes');
    publications.slice(0, 5).forEach((publication, index) => {
      const previous = publications[index + 1];
      lines.push(
        `  ${age(publication.published_at).padEnd(10)}` +
          `${publication.row_count.toLocaleString('en-US')} rows` +
          (previous
            ? ` (${signed(publication.row_count - previous.row_count)})`
            : ''),
      );
    });
  }
  return lines.join('\n');
}
