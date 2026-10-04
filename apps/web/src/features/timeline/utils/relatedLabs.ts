import { BundleEntry, Observation } from 'fhir/r2';
import { RxDatabase, RxDocument } from 'rxdb';

import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
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
}): Promise<RxDocument<ClinicalDocument<BundleEntry<Observation>>>[]> {
  if (loinc.length === 0) {
    return [];
  }
  const docs = (await db.clinical_documents
    .find({
      selector: { user_id: user.id, 'metadata.loinc_coding': { $in: loinc } },
    })
    .exec()) as unknown as RxDocument<
    ClinicalDocument<BundleEntry<Observation>>
  >[];
  return groupIdenticalLabRecords(docs).map((group) => group[0]);
}
