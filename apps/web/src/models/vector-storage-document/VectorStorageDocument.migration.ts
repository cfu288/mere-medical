import { MigrationStrategies } from 'rxdb';
import { VectorStorageDocument } from './VectorStorageDocument.type';

export const VectorStorageDocumentMigrations: MigrationStrategies = {
  1: function (oldDoc) {
    delete oldDoc.hits;
    return oldDoc;
  },
  2: function (oldDoc: VectorStorageDocument) {
    oldDoc.hash = '';
    return oldDoc;
  },
  3: function (oldDoc: VectorStorageDocument) {
    // no change
    return oldDoc;
  },
  4: function (oldDoc: VectorStorageDocument) {
    // Added metadata fields for chunk tracking
    if (!oldDoc.metadata) {
      oldDoc.metadata = {};
    }
    return oldDoc;
  },
};
