import { DatabaseSync } from 'node:sqlite';
import { DynamicModule, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { openReferencesDbReadOnly } from '@mere/reference-pipeline';
import { ReferenceController } from './reference.controller';

/**
 * Serves the reference library to the chat agent under
 * `v1/agent/references`. `AppModule` imports it only when
 * `parseReferenceLibraryConfig` reports the library enabled. A bad library
 * file stops the API from starting.
 */
@Module({})
export class ReferenceModule implements OnModuleDestroy {
  constructor(private readonly db: DatabaseSync) {}

  onModuleDestroy() {
    this.db.close();
  }

  /**
   * @param path `string`. The library file.
   * @returns `DynamicModule`.
   *
   * @example
   * ReferenceModule.register('/data/references.db');
   */
  static register(path: string): DynamicModule {
    return {
      module: ReferenceModule,
      controllers: [ReferenceController],
      providers: [
        {
          provide: DatabaseSync,
          useFactory: () => {
            const db = openReferencesDbReadOnly(path);
            Logger.log(`Reference library loaded from ${path}.`);
            return db;
          },
        },
      ],
    };
  }
}
