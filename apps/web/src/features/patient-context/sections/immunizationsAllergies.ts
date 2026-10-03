import { BundleEntry, FhirResource, Immunization } from 'fhir/r2';

import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import {
  getAllergyIntoleranceDisplayName,
  getImmunizationVaccineCode,
} from '../../../shared/utils/fhirAccessHelpers';
import {
  compareDateInfoDesc,
  DateInfo,
  entry,
  formatDate,
  latestBy,
  RecordEntry,
  toDateInfo,
} from '../types';

const ALLERGY_PLACEHOLDER = /^(not on file|unable to assess)/i;

function notGiven(resource: Immunization | undefined): boolean {
  const status = (resource as { status?: string } | undefined)?.status;
  return (
    resource?.wasNotGiven === true ||
    status === 'not-done' ||
    status === 'entered-in-error'
  );
}

export function buildImmunizationEntries(
  docs: ClinicalDocument<BundleEntry<FhirResource>>[],
): RecordEntry[] {
  const byConcept = new Map<string, { name: string; date: DateInfo }[]>();
  for (const doc of docs) {
    const resource = doc.data_record.raw?.resource as Immunization | undefined;
    if (notGiven(resource)) {
      continue;
    }
    const name =
      doc.metadata?.display_name ??
      resource?.vaccineCode?.text ??
      resource?.vaccineCode?.coding?.[0]?.display;
    if (!name) {
      continue;
    }
    const code = getImmunizationVaccineCode(doc);
    const concept = code ? `code:${code}` : name.toLowerCase();
    const date = toDateInfo(doc.metadata?.date);
    const doses = byConcept.get(concept);
    if (doses) {
      doses.push({ name, date });
    } else {
      byConcept.set(concept, [{ name, date }]);
    }
  }
  return [...byConcept.values()]
    .map((doses) => {
      const sorted = [...doses].sort((a, b) =>
        compareDateInfoDesc(a.date, b.date),
      );
      return entry(
        'immunization',
        sorted[0].name,
        sorted[0].date,
        sorted.length > 1
          ? [`doses: ${sorted.map((d) => formatDate(d.date)).join(', ')}`]
          : [],
      );
    })
    .sort((a, b) => compareDateInfoDesc(a.date, b.date));
}

export function buildAllergyEntries(
  docs: ClinicalDocument<BundleEntry<FhirResource>>[],
): RecordEntry[] {
  const entries = docs.flatMap((doc) => {
    const name = (getAllergyIntoleranceDisplayName(doc) ?? '')
      .replace(/\*+$/, '')
      .trim();
    return name && !ALLERGY_PLACEHOLDER.test(name)
      ? [entry('allergy', name, toDateInfo(doc.metadata?.date), [])]
      : [];
  });
  return latestBy(
    entries,
    (e) => e.name.toLowerCase(),
    (e) => e.date,
  );
}
