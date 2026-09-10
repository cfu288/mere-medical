import type { DatabaseSync } from 'node:sqlite';
import type { Vendor } from '@mere/shared';
import { ADAPTERS } from '../adapters';
import * as downloads from '../db/repository/capability-downloads';
import * as directoryCounts from '../db/repository/directory-counts';
import * as publications from '../db/repository/publications';
import * as runs from '../db/repository/fetch-runs';
import * as snapshots from '../db/repository/directory-snapshots';

/** Renders a delta as +n or -n for the status table. */
function signed(n: number): string {
  return n < 0 ? String(n) : `+${n}`;
}

/**
 * Renders the warehouse's crawl, transform, and publish state as a fixed-width text
 * table, one row per vendor and version, with ages computed relative to `now`. The
 * monthly workflow posts it on the refresh pull request, where a human decides
 * whether to merge.
 *
 * @param db - An open warehouse from `openWarehouse`.
 * @param now - The ISO timestamp ages are computed against.
 * @returns The table followed by the recent publish history, ready to print.
 * @example
 * console.log(formatStatus(db, new Date().toISOString()));
 *
 * This prints a report shaped like:
 *
 *   vendor     version  endpoints   failing crawled   transform
 *   athena     R4           17437         - 2d ago    current
 *   epic       R4             820         0 today     current
 *
 *   publishes
 *     today     39,560 rows (+0)
 *     2d ago    39,560 rows (-5413)
 */
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
        lastFailed === undefined
          ? '-'
          : previousFailed !== undefined && lastFailed !== previousFailed
            ? `${lastFailed} (${signed(lastFailed - previousFailed)})`
            : String(lastFailed);

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
