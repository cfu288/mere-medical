import { MigrationStrategies } from 'rxdb';

export const UserPreferencesMigrations: MigrationStrategies = {
  // 1 means, this transforms data from version 0 to version 1
  1: function (oldDoc) {
    // We set default for use_proxy to true, but don't change existing preferences
    return oldDoc;
  },
  2: function (oldDoc) {
    // No changes
    return oldDoc;
  },
};
