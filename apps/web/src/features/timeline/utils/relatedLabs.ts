import { BundleEntry, Observation } from 'fhir/r2';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { findRecordsByLoincCodes } from '../../../repositories/ClinicalDocumentRepository';
import { groupIdenticalLabRecords } from '../../../shared/utils/labResults';

/** Every result sharing a LOINC code, oldest first, one document per identical result. */
export async function getRelatedLoincLabs({
  loinc,
  db,
  user,
}: {
  loinc: string[];
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
}): Promise<ClinicalDocument<BundleEntry<Observation>>[]> {
  const docs = (await findRecordsByLoincCodes(
    db,
    user.id,
    loinc,
  )) as ClinicalDocument<BundleEntry<Observation>>[];
  return groupIdenticalLabRecords(docs).map((group) => group[0]);
}
