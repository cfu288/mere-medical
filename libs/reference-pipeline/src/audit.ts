import { existsSync } from 'fs';
import { join } from 'path';

import { openReferencesDb } from './lib/referencesDb';
import { printAudit } from './printAudit';

function main() {
  const dbPath =
    process.argv[2] ?? join(__dirname, '..', 'data', 'references.db');
  if (!existsSync(dbPath)) {
    console.error(
      `${dbPath}: no library is at this path. Build it with the CLI first.`,
    );
    process.exit(1);
  }
  printAudit(openReferencesDb(dbPath), dbPath);
}

main();
