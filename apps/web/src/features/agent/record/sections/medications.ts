import { ClinicalDocumentResourceType } from '../../../../models/clinical-document/ClinicalDocument.type';
import { getMedicationOrderDisplayName } from '../../../../shared/utils/fhirAccessHelpers';
import { ClinicalDoc } from '../clinicalDocs';
import { entry, latestByName, RecordEntry, toDateInfo } from '../types';

export const MEDICATION_TYPES: ClinicalDocumentResourceType[] = [
  'medicationstatement',
  'medicationrequest',
  'medicationorder',
  'medicationdispense',
  'medicationadministration',
];

export function buildMedicationEntries(docs: ClinicalDoc[]): RecordEntry[] {
  const entries = docs.flatMap((doc) => {
    const name = getMedicationOrderDisplayName(doc);
    return name
      ? [entry('medication', name, toDateInfo(doc.metadata?.date), [])]
      : [];
  });
  return latestByName(entries);
}
