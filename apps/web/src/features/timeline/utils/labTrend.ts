import { BundleEntry, Observation } from 'fhir/r2';

import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { getValueQuantity, getValueUnit } from './fhirpathParsers';

type LabDocument = ClinicalDocument<BundleEntry<Observation>>;

/** The results a trend graph can plot beside the row: numeric, in the row's own unit. */
export function graphableLabs<T extends LabDocument>(
  row: LabDocument,
  related: T[],
): T[] {
  const unit = getValueUnit(row);
  return related.filter(
    (doc) => getValueQuantity(doc) !== undefined && getValueUnit(doc) === unit,
  );
}

/** Numeric results the graph leaves out because their unit is not the row's, counted by unit. */
export function unplotted<T extends LabDocument>(
  row: LabDocument,
  related: T[],
): { unit: string; count: number }[] {
  const unit = getValueUnit(row);
  const counts = new Map<string, number>();
  for (const doc of related) {
    if (getValueQuantity(doc) === undefined || getValueUnit(doc) === unit) {
      continue;
    }
    const label = getValueUnit(doc) ?? 'no unit';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => ({ unit: label, count }));
}

export function sparklineValues(graphable: LabDocument[]): number[] {
  return graphable.flatMap((doc) => {
    const value = getValueQuantity(doc);
    return value === undefined ? [] : [value];
  });
}
