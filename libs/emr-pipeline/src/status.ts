import type { DatabaseSync } from 'node:sqlite';
import type { Vendor } from '@mere/shared';
import { ADAPTERS } from './adapters';
import * as downloads from './db/repository/capability-downloads';
import * as directoryCounts from './db/repository/directory-counts';
import * as publications from './db/repository/publications';
import * as runs from './db/repository/fetch-runs';
import * as snapshots from './db/repository/directory-snapshots';

function signed(n: number): string {
  return n < 0 ? String(n) : `+${n}`;
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

  const vendors = (Object.keys(ADAPTERS) as Vendor[]).sort((a, b) =>
    a.localeCompare(b),
  );
  for (const vendor of vendors) {
    for (const version of ADAPTERS[vendor].versions) {
      const directoryCount = directoryCounts.find(db, vendor, version);
      const failing = downloads.countFailing(db, vendor, version);
      const latestSnapshot = snapshots.latestFetchedAt(db, vendor, version);
      const latestCapability = downloads.latestDownloadedAt(
        db,
        vendor,
        version,
      );
      const crawled = [latestSnapshot, latestCapability]
        .filter((t): t is string => t !== null)
        .sort()
        .at(-1);

      const [lastFailed, previousFailed] = runs.lastTwoFailedCounts(
        db,
        vendor,
        version,
      );
      const failingCell =
        lastFailed != null &&
        previousFailed != null &&
        lastFailed !== previousFailed
          ? `${failing} (${signed(lastFailed - previousFailed)})`
          : String(failing);

      const transform = latestSnapshot
        ? !directoryCount || latestSnapshot > directoryCount.seen_at
          ? 'BEHIND'
          : 'current'
        : directoryCount
          ? 'current'
          : '-';

      lines.push(
        line([
          vendor,
          version,
          directoryCount ? String(directoryCount.tenant_count) : '-',
          failingCell,
          crawled ? age(crawled) : 'never',
          transform,
        ]),
      );
    }
  }

  const recent = publications.listRecent(db, 6);
  lines.push('');
  if (recent.length === 0) {
    lines.push('published: never');
  } else {
    lines.push('publishes');
    recent.slice(0, 5).forEach((publication, index) => {
      const previous = recent[index + 1];
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
