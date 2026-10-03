import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Logger, Module } from '@nestjs/common';
import { openReferencesDb } from '@mere/reference-pipeline';
import { ReferenceController } from './reference.controller';

function openConfiguredDb() {
  const dbPath =
    process.env['REFERENCE_DB_PATH'] ??
    path.join(process.cwd(), 'libs/reference-pipeline/data/references.db');
  if (!fs.existsSync(dbPath)) {
    Logger.log(`No references db at ${dbPath}, serving empty results`);
    return openReferencesDb(':memory:');
  }
  Logger.log(`References db loaded from ${dbPath}`);
  return openReferencesDb(dbPath);
}

@Module({
  controllers: [ReferenceController],
  providers: [{ provide: DatabaseSync, useFactory: openConfiguredDb }],
})
export class ReferenceModule {}
