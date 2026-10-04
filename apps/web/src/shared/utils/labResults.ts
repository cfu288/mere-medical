import { BundleEntry, Observation } from 'fhir/r2';

import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import {
  getComments,
  getInterpretationText,
  getReferenceRangeString,
  getValueQuantityString,
  getValueRangeString,
  getValueRatioString,
  getValueString,
  getValueUnit,
  isOutOfRangeResult,
} from '../../features/timeline/utils/fhirpathParsers';

type LabDocument = ClinicalDocument<BundleEntry<Observation>>;

/** What a result measures: its LOINC code, or its code text when it has no code. */
export function labAnalyteKey(doc: LabDocument): string {
  const loinc = doc.metadata?.loinc_coding?.[0];
  if (loinc) {
    return loinc;
  }
  const text =
    doc.data_record.raw?.resource?.code?.text ?? doc.metadata?.display_name;
  return `text:${(text ?? '').toLowerCase()}`;
}

/** The value exactly as the timeline row shows it. */
export function labValueText(doc: LabDocument): string | undefined {
  return (
    getValueQuantityString(doc) ||
    getValueRangeString(doc) ||
    getValueRatioString(doc) ||
    getInterpretationText(doc) ||
    getValueString(doc) ||
    undefined
  );
}

function interpretationKey(doc: LabDocument): string {
  return [
    getInterpretationText(doc) ?? '',
    isOutOfRangeResult(doc) ? 'abnormal' : 'normal',
  ].join(',');
}

/** Two coded results are one record only when every field the timeline shows matches: test, time, value, unit, reference range, interpretation and comments. Uncoded results never merge. */
function labRecordKey(doc: LabDocument): string {
  if (!doc.metadata?.loinc_coding?.[0]) {
    return `id:${doc.id}`;
  }
  return [
    labAnalyteKey(doc),
    doc.metadata?.date ?? '',
    labValueText(doc) ?? '',
    getValueUnit(doc) ?? '',
    getReferenceRangeString(doc) ?? '',
    interpretationKey(doc),
    getComments(doc) ?? '',
  ].join('|');
}

function dateOrder(doc: LabDocument): number {
  return Date.parse(doc.metadata?.date ?? '') || 0;
}

/** Results oldest first, each group holding the documents that record one identical result. */
export function groupIdenticalLabRecords<T extends LabDocument>(
  docs: T[],
): T[][] {
  const groups = new Map<string, T[]>();
  for (const doc of docs) {
    const key = labRecordKey(doc);
    const group = groups.get(key);
    if (group) {
      group.push(doc);
    } else {
      groups.set(key, [doc]);
    }
  }
  return [...groups.values()].sort((a, b) => dateOrder(a[0]) - dateOrder(b[0]));
}
