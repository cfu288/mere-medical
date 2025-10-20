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
  5: function (oldDoc: VectorStorageDocument) {
    // Add top-level user_id field from metadata
    if (oldDoc.metadata?.['user_id']) {
      oldDoc.user_id = oldDoc.metadata['user_id'];
    } else {
      // Fallback: Since the app is currently single-user, we'll mark these
      // documents to be updated when the user is known
      // We can't query the database in migrations, so we use a placeholder
      // that will be handled by the application
      oldDoc.user_id = 'migration_pending';
    }
    return oldDoc;
  },
};
