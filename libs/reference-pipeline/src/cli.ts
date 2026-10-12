import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

import { ingestSources } from './lib/ingest';
import { openReferencesDb } from './lib/referencesDb';
import { createFetchBytes } from './lib/fetchBytes';
import { parseSources } from './lib/sources';
import { printAudit } from './printAudit';

async function main() {
  const root = join(__dirname, '..');
  const sourcesPath = process.argv[2] ?? join(root, 'sources.json');
  const dbPath = process.argv[3] ?? join(root, 'data', 'references.db');
  const sources = parseSources(JSON.parse(readFileSync(sourcesPath, 'utf8')));
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = openReferencesDb(dbPath);
  const reports = await ingestSources({
    db,
    sources,
    fetchBytes: createFetchBytes(),
  });
  for (const report of reports) {
    if (report.status === 'skipped') {
      console.log(`\nskipped ${report.id}: ${report.url} was already ingested`);
      continue;
    }
    switch (report.status) {
      case 'written':
        console.log(`\n${report.id}: ${report.outline.length} sections`);
        break;
      case 'unchanged':
        console.log(
          `\n${report.id}: kept as it was, its source parsed to nothing`,
        );
        break;
      case 'missing':
        console.log(
          `\n${report.id}: could not add, its source parsed to nothing`,
        );
        break;
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
  console.log(
    `\nwrote ${reports.filter((r) => r.status === 'written').length} reference(s) to ${dbPath}`,
  );
  console.log();
  printAudit(db, dbPath);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
