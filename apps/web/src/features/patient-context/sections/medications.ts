import { BundleEntry, FhirResource } from 'fhir/r2';

import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
} from '../../../models/clinical-document/ClinicalDocument.type';
import { getMedicationOrderDisplayName } from '../../../shared/utils/fhirAccessHelpers';
import { entry, latestBy, RecordEntry, toDateInfo } from '../types';

export const MEDICATION_TYPES: ClinicalDocumentResourceType[] = [
  'medicationstatement',
  'medicationrequest',
  'medicationorder',
  'medicationdispense',
  'medicationadministration',
];

export function buildMedicationEntries(
  docs: ClinicalDocument<BundleEntry<FhirResource>>[],
): RecordEntry[] {
  const entries = docs.flatMap((doc) => {
    const name = getMedicationOrderDisplayName(doc);
    return name
      ? [entry('medication', name, toDateInfo(doc.metadata?.date), [])]
      : [];
  });
  return latestBy(
    entries,
    (e) => e.name.toLowerCase(),
    (e) => e.date,
  );
}
