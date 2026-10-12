import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { createFetchBytes } from './lib/fetchBytes';
import { buildLibrary } from './lib/ingest';
import { parseSources } from './lib/sources';

const ROOT = join(__dirname, '..');
const SOURCES_PATH = join(ROOT, 'sources.json');
const LIBRARY_PATH = join(ROOT, 'data', 'references.db');

async function main() {
  const sources = parseSources(JSON.parse(readFileSync(SOURCES_PATH, 'utf8')));
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  const reports = await buildLibrary({
    path: LIBRARY_PATH,
    sources,
    fetchBytes: createFetchBytes(),
  });
  for (const report of reports) {
    switch (report.status) {
      case 'written':
        console.log(`\n${report.id}: ${report.outline.length} sections`);
        for (const entry of report.outline) {
          console.log(
            `${'  '.repeat(entry.depth + 1)}${entry.sectionId} | ${entry.title} | ${entry.chars} chars`,
          );
        }
        break;
      case 'empty':
        console.log(`\n${report.id}: not added, its source parsed to nothing`);
        break;
    }
    if (report.dropped.length > 0) {
      console.log(`  dropped: ${report.dropped.join('; ')}`);
    }
  }
  console.log(
    `\nwrote ${reports.filter((r) => r.status === 'written').length} reference(s) to ${LIBRARY_PATH}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
