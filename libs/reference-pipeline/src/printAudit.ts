import { DatabaseSync } from 'node:sqlite';

import { auditLibrary } from './lib/audit';

const EXAMPLES_PER_CHECK = 10;
const LARGEST_SECTIONS = 10;

/**
 * Prints the audit of a library to the console. It prints the number of
 * findings, then each check's findings with up to 10 examples, then the 10
 * largest sections.
 *
 * @param db `DatabaseSync`. A library opened with `openReferencesDb`.
 * @param label `string`. Names the library in the first line, usually its
 * path.
 * @returns `void`.
 *
 * @example
 * printAudit(openReferencesDb('references.db'), 'references.db');
 * // references.db: 1 findings
 * //
 * // short-reference (1)
 * //   measles: 10 characters of text
 * //
 * // largest sections
 * //   measles/doses: 10 chars
 */
export function printAudit(db: DatabaseSync, label: string) {
  const findings = auditLibrary(db);
  const byCheck = Map.groupBy(findings, (finding) => finding.check);
  console.log(`${label}: ${findings.length} findings`);
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
