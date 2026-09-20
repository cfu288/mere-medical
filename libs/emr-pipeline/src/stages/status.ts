import type { Vendor } from '@mere/shared';
import { ADAPTERS } from '../adapters';
import type { Warehouse } from '../db/open';
import * as downloads from '../db/repository/capability-downloads';
import * as directoryCounts from '../db/repository/directory-counts';
import * as publications from '../db/repository/publications';
import * as runs from '../db/repository/fetch-runs';
import * as vendorTenantDirectory from '../db/repository/vendor-tenant-directory-snapshots';

/** Renders a delta as +n or -n for the status table. */
function signed(n: number): string {
  return n < 0 ? String(n) : `+${n}`;
}

/**
 * Renders crawl, transform, and publish state as a fixed-width text table, one
 * row per vendor and version. The monthly workflow posts it on the refresh PR
 * for human review.
 *
 * @returns The table plus recent publish history, ready to print.
 * @example
 * console.log(formatStatus(db));
 *
 * This prints a report shaped like:
 *
 *   vendor     version  endpoints   failing crawled   transform
 *   epic       R4             820         0 today     current
 *
 *   failures
 *     veradigm DSTU2  792x HTTP 500
 *
 *   publishes
 *     today     39,560 rows (+0)
 */
export async function formatStatus(db: Warehouse): Promise<string> {
  const now = new Date().toISOString();
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
      const directoryCount = await directoryCounts.find(db, vendor, version);
      const latestSnapshot = await vendorTenantDirectory.latestFetchedAt(
        db,
        vendor,
        version,
      );
      const latestCapability = await downloads.latestDownloadedAt(
        db,
        vendor,
        version,
      );
      const crawled = [latestSnapshot, latestCapability]
        .filter((t): t is string => t !== null)
        .sort()
        .at(-1);

      const [lastFailed, previousFailed] = await runs.lastTwoFailedCounts(
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

  const failureLines: string[] = [];
  for (const vendor of vendors) {
    for (const version of ADAPTERS[vendor].versions) {
      const top = await downloads.topFailureMessages(db, vendor, version, 3);
      if (top.length === 0) continue;
      const parts = top
        .map((failure) => `${failure.count}x ${failure.message}`)
        .join(', ');
      failureLines.push(`  ${vendor} ${version}  ${parts}`);
    }
  }
  if (failureLines.length > 0) {
    lines.push('', 'failures', ...failureLines);
  }

  const recent = await publications.listRecent(db, 6);
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
