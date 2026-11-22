import { Immunization } from 'fhir/r2';

import {
  getAllergyIntoleranceDisplayName,
  getImmunizationVaccineCode,
} from '../../../../shared/utils/fhirAccessHelpers';
import { groupBy } from '../../../../shared/utils/groupBy';
import {
  ClinicalDoc,
  compareDateInfoDesc,
  entry,
  formatDate,
  latestByName,
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

export function buildImmunizationEntries(docs: ClinicalDoc[]): RecordEntry[] {
  const doses = docs.flatMap((doc) => {
    const resource = doc.data_record.raw?.resource as Immunization | undefined;
    const name =
      doc.metadata?.display_name ??
      resource?.vaccineCode?.text ??
      resource?.vaccineCode?.coding?.[0]?.display;
    if (notGiven(resource) || !name) {
      return [];
    }
    const code = getImmunizationVaccineCode(doc);
    return [
      {
        concept: code ? `code:${code}` : name.toLowerCase(),
        name,
        date: toDateInfo(doc.metadata?.date),
      },
    ];
  });
  return [...groupBy(doses, (dose) => dose.concept).values()]
    .map((doses) => {
      const sorted = [...doses].sort((a, b) =>
        compareDateInfoDesc(a.date, b.date),
      );
      // two connections can hold the same dose
      const dates = [...new Set(sorted.map((d) => formatDate(d.date)))];
      return entry(
        'immunization',
        sorted[0].name,
        sorted[0].date,
        dates.length > 1 ? [`doses: ${dates.join(', ')}`] : [],
      );
    })
    .sort((a, b) => compareDateInfoDesc(a.date, b.date));
}

export function buildAllergyEntries(docs: ClinicalDoc[]): RecordEntry[] {
  const entries = docs.flatMap((doc) => {
    const name = (getAllergyIntoleranceDisplayName(doc) ?? '')
      .replace(/\*+$/, '')
      .trim();
    return name && !ALLERGY_PLACEHOLDER.test(name)
      ? [entry('allergy', name, toDateInfo(doc.metadata?.date), [])]
      : [];
  });
  return latestByName(entries);
}
