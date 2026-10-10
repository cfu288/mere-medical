import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { setTimeout as sleep } from 'timers/promises';

import { ingestSources } from './lib/ingest';
import { openReferencesDb } from './lib/referencesDb';
import { createCrawlDelayedFetch } from './lib/crawlDelayedFetch';
import { parseSources } from './lib/sources';
import { printAudit } from './printAudit';

const crawlDelayedFetch = createCrawlDelayedFetch({
  fetchImpl: fetch,
  sleep,
  now: Date.now,
});

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await crawlDelayedFetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} returned ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function main() {
  const root = join(__dirname, '..');
  const sourcesPath = process.argv[2] ?? join(root, 'sources.json');
  const dbPath = process.argv[3] ?? join(root, 'data', 'references.db');
  const sources = parseSources(JSON.parse(readFileSync(sourcesPath, 'utf8')));
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = openReferencesDb(dbPath);
  const {
    references: reports,
    skipped,
    unchanged,
    missing,
  } = await ingestSources({
    db,
    sources,
    fetchBytes,
  });
  for (const report of reports) {
    if (unchanged.includes(report.id)) {
      console.log(
        `\n${report.id}: kept as it was, its source parsed to nothing`,
      );
    } else if (missing.includes(report.id)) {
      console.log(
        `\n${report.id}: could not add, its source parsed to nothing`,
      );
    } else {
      console.log(`\n${report.id}: ${report.outline.length} sections`);
    }
    for (const entry of report.outline) {
      console.log(
        `${'  '.repeat(entry.depth + 1)}${entry.sectionId} | ${entry.title} | ${entry.chars} chars`,
      );
    }
    if (report.dropped.length > 0) {
      console.log(`  dropped: ${report.dropped.join('; ')}`);
    }
  }
  for (const { id, url } of skipped) {
    console.log(`\nskipped ${id}: ${url} was already ingested`);
  }
  console.log(
    `\nwrote ${reports.length - unchanged.length - missing.length} reference(s) to ${dbPath}`,
  );
  console.log();
  printAudit(db, dbPath);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
