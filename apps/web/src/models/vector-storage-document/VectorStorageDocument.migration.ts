import { MigrationStrategies } from 'rxdb';

export const VectorStorageDocumentMigrations: MigrationStrategies = {
  1: function (oldDoc) {
    delete oldDoc.hits;
    return oldDoc;
  },
};
