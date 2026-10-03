import { BundleEntry, Encounter, FhirResource } from 'fhir/r2';
import {
  BundleEntry as R4BundleEntry,
  Encounter as R4Encounter,
} from 'fhir/r4';

import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { getEncounterClass } from '../../../shared/utils/fhirAccessHelpers';
import { compareDateInfoDesc, entry, RecordEntry, toDateInfo } from '../types';

export function buildEncounterEntries(
  docs: ClinicalDocument<BundleEntry<FhirResource>>[],
): RecordEntry[] {
  return docs
    .map(toEncounterEntry)
    .sort((a, b) => compareDateInfoDesc(a.date, b.date));
}

function toEncounterEntry(
  doc: ClinicalDocument<BundleEntry<FhirResource>>,
): RecordEntry {
  const resource = doc.data_record.raw?.resource as Encounter | undefined;
  const facts = [
    resource?.participant?.[0]?.individual?.display,
    resource?.serviceProvider?.display ??
      resource?.location?.[0]?.location?.display,
    encounterReason(doc),
  ].filter((fact): fact is string => Boolean(fact));
  return entry(
    'encounter',
    resource?.type?.[0]?.text ?? getEncounterClass(doc) ?? 'Encounter',
    toDateInfo(resource?.period?.start ?? doc.metadata?.date),
    facts,
  );
}

function encounterReason(
  doc: ClinicalDocument<BundleEntry<FhirResource>>,
): string | undefined {
  switch (doc.data_record.format) {
    case 'FHIR.R4': {
      const resource = (doc.data_record.raw as R4BundleEntry<R4Encounter>)
        ?.resource;
      const reason = resource?.reasonCode?.[0];
      return reason?.text ?? reason?.coding?.[0]?.display;
    }
    case 'FHIR.DSTU2': {
      const resource = (doc.data_record.raw as BundleEntry<Encounter>)
        ?.resource;
      const reason = resource?.reason?.[0];
      return reason?.text ?? reason?.coding?.[0]?.display;
    }
    default:
      return undefined;
  }
}
