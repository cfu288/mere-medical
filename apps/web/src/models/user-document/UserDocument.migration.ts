import { MigrationStrategies } from 'rxdb';

export const UserDocumentMigrations: MigrationStrategies = {
  // 1 means, this transforms data from version 0 to version 1
  1: function (oldDoc) {
    // We add a new empty attachments object
    oldDoc._attachments = {};
    return oldDoc;
  },
};
