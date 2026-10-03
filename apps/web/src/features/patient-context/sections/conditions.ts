import { BundleEntry, Condition, FhirResource } from 'fhir/r2';
import {
  BundleEntry as R4BundleEntry,
  Condition as R4Condition,
} from 'fhir/r4';

import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { entry, latestBy, RecordEntry, toDateInfo } from '../types';

// ICD-10-CM block Z00-Z13, "Persons encountering health services for examinations"
const EXAMINATION_ICD10 = /^Z(0\d|1[0-3])/;

export function buildConditionEntries(
  docs: ClinicalDocument<BundleEntry<FhirResource>>[],
): RecordEntry[] {
  const entries: RecordEntry[] = [];
  for (const doc of docs) {
    const resource = doc.data_record.raw?.resource as Condition | undefined;
    const name = doc.metadata?.display_name ?? resource?.code?.text;
    if (!name || isAdministrative(resource)) {
      continue;
    }
    const statuses = conditionStatuses(doc).filter(Boolean).join('/');
    entries.push(
      entry(
        'condition',
        name,
        toDateInfo(doc.metadata?.date),
        statuses ? [statuses] : [],
      ),
    );
  }
  return latestBy(
    entries,
    (e) => e.name.toLowerCase(),
    (e) => e.date,
  );
}

function isAdministrative(resource?: Condition): boolean {
  const codings = resource?.code?.coding ?? [];
  const icd10 = codings.find((c) => c.system?.includes('icd-10'));
  return Boolean(
    icd10?.code && EXAMINATION_ICD10.test(icd10.code.toUpperCase()),
  );
}

function conditionStatuses(
  doc: ClinicalDocument<BundleEntry<FhirResource>>,
): (string | undefined)[] {
  switch (doc.data_record.format) {
    case 'FHIR.R4': {
      const resource = (doc.data_record.raw as R4BundleEntry<R4Condition>)
        ?.resource;
      return [
        resource?.clinicalStatus?.coding?.[0]?.code,
        resource?.verificationStatus?.coding?.[0]?.code,
      ];
    }
    case 'FHIR.DSTU2': {
      const resource = (doc.data_record.raw as BundleEntry<Condition>)
        ?.resource;
      return [resource?.clinicalStatus, resource?.verificationStatus];
    }
    default:
      return [];
  }
}
