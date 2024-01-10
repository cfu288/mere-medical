import { MigrationStrategies } from 'rxdb';
import { ConnectionDocument } from './ConnectionDocument.type';

export const ConnectionDocumentMigrations: MigrationStrategies = {
  // 1 means, this transforms data from version 0 to version 1
  1: function (oldDoc) {
    oldDoc.auth_uri = '';
    oldDoc.id_token = '';
    return oldDoc;
  },
  2: function (oldDoc) {
    oldDoc.token_uri = '';
    return oldDoc;
  },
  3: function (oldDoc) {
    // handle new fields last_sync_was_error, last_sync_attempt
    oldDoc.last_sync_was_error = false;
    oldDoc.last_sync_attempt = oldDoc.last_refreshed;
    return oldDoc;
  },
  4: function (oldDoc: Required<ConnectionDocument>) {
    oldDoc.expires_at = (
      oldDoc as ConnectionDocument & { expires_in: number }
    ).expires_in;
    delete (oldDoc as ConnectionDocument & { expires_in?: number }).expires_in;
    return oldDoc;
  },
};
