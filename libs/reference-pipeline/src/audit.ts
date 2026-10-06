import { existsSync } from 'fs';
import { join } from 'path';

import { auditLibrary, Finding } from './lib/audit';
import { openReferencesDb } from './lib/referencesDb';

const EXAMPLES_PER_CHECK = 10;
const LARGEST_SECTIONS = 10;

function main() {
  const dbPath =
    process.argv[2] ?? join(__dirname, '..', 'data', 'references.db');
  if (!existsSync(dbPath)) {
    console.error(`${dbPath}: no library here; build it with the CLI first`);
    process.exit(1);
  }
  const db = openReferencesDb(dbPath);
  const findings = auditLibrary(db);
  const byCheck = new Map<Finding['check'], Finding[]>();
  for (const finding of findings) {
    byCheck.set(finding.check, [
      ...(byCheck.get(finding.check) ?? []),
      finding,
    ]);
  }
  console.log(`${dbPath}: ${findings.length} findings`);
  for (const [check, list] of byCheck) {
    console.log(`\n${check} (${list.length})`);
    for (const f of list.slice(0, EXAMPLES_PER_CHECK)) {
      console.log(
        `  ${f.reference}${f.section ? `/${f.section}` : ''}: ${f.detail}`,
      );
    }
    if (list.length > EXAMPLES_PER_CHECK) {
      console.log(`  ${list.length - EXAMPLES_PER_CHECK} more`);
    }
  }
  console.log('\nlargest sections');
  const largest = db
    .prepare(
      'SELECT document_id, section_id, length(content_md) AS chars FROM sections ORDER BY chars DESC LIMIT ?',
    )
    .all(LARGEST_SECTIONS) as {
    document_id: string;
    section_id: string;
    chars: number;
  }[];
  for (const s of largest) {
    console.log(`  ${s.document_id}/${s.section_id}: ${s.chars} chars`);
  }
}

main();
