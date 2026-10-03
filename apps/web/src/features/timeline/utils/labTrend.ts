import { BundleEntry, Observation } from 'fhir/r2';

import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { getValueQuantity } from './fhirpathParsers';

type LabDocument = ClinicalDocument<BundleEntry<Observation>>;

/** The results a trend graph can plot: those with a numeric value. */
export function graphableLabs<T extends LabDocument>(related: T[]): T[] {
  return related.filter((doc) => getValueQuantity(doc) !== undefined);
}

export function sparklineValues(graphable: LabDocument[]): number[] {
  return graphable.flatMap((doc) => {
    const value = getValueQuantity(doc);
    return value === undefined ? [] : [value];
  });
}
