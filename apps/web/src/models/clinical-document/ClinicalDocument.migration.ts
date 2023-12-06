import { MigrationStrategies } from 'rxdb';
import { ClinicalDocument } from './ClinicalDocument.type';

export const ClinicalDocumentMigrations: MigrationStrategies = {
  // 1 means, this transforms data from version 0 to version 1
  1: function (oldDoc: Required<ClinicalDocument>) {
    // We add a new empty loinc coding
    oldDoc.metadata.loinc_coding = [];
    return oldDoc;
  },
  2: function (oldDoc: Required<ClinicalDocument>) {
    oldDoc.id = `${oldDoc.connection_record_id}|${oldDoc.user_id}|${oldDoc.metadata.id}`;
    return oldDoc;
  },
  3: function (oldDoc: Required<ClinicalDocument>) {
    oldDoc.metadata.is_pinned = false;
    return oldDoc;
  },
};
