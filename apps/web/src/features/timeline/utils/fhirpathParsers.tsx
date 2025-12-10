import { BundleEntry, Observation } from 'fhir/r2';
import * as fhirpath from 'fhirpath';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';

export function getReferenceRangeString(
  item: ClinicalDocument<BundleEntry<Observation>>,
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'referenceRange.text',
  )?.[0];
}

export function getReferenceRangeLow(
  item: ClinicalDocument<BundleEntry<Observation>>,
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'referenceRange.low',
  )?.[0];
}

export function getReferenceRangeHigh(
  item: ClinicalDocument<BundleEntry<Observation>>,
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'referenceRange.high',
  )?.[0];
}

export function getValueUnit(
  item: ClinicalDocument<BundleEntry<Observation>>,
): string | undefined {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'valueQuantity.unit',
  )?.[0];
}

export function getValueQuantity(
  item: ClinicalDocument<BundleEntry<Observation>>,
): number | undefined {
  const val: number | undefined = fhirpath.evaluate(
    item.data_record.raw.resource,
    'valueQuantity.value',
  )?.[0];

  return val;
}

function formatValueQuantity(
  item: ClinicalDocument<BundleEntry<Observation>>,
): string | undefined {
  const val: number | undefined = getValueQuantity(item);
  if (val && val?.toString().length > 5) {
    return Number.isInteger(val) ? `${val}` : val?.toPrecision(5);
  }
  return undefined;
}

export function getValueString(
  item: ClinicalDocument<BundleEntry<Observation>>,
) {
  return fhirpath.evaluate(item.data_record.raw.resource, 'valueString')?.[0];
}

export function getComments(item: ClinicalDocument<BundleEntry<Observation>>) {
  return fhirpath.evaluate(item.data_record.raw.resource, 'comments')?.[0];
}

export function getInterpretationText(
  item: ClinicalDocument<BundleEntry<Observation>>,
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'interpretation.text',
  )?.[0];
}
/**
 * Takes a RxDocument of type ClinicalDocument<Observation> and returns true if the value is out of reference range
 * @param item
 */

export function isOutOfRangeResult(
  item: ClinicalDocument<BundleEntry<Observation>>,
): boolean {
  const low = item.data_record.raw.resource?.referenceRange?.[0]?.low?.value;
  const high = item.data_record.raw.resource?.referenceRange?.[0]?.high?.value;
  const value = item.data_record.raw.resource?.valueQuantity?.value;

  if (low && high && value && !isNaN(low) && !isNaN(high) && !isNaN(value)) {
    return value < low || value > high;
  }
  return false;
}
