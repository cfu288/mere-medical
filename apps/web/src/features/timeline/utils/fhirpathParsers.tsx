import { BundleEntry, Observation } from 'fhir/r2';
import * as fhirpath from 'fhirpath';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';

type ReferenceRangeShape =
  | 'text'
  | 'bounded'
  | 'low-only'
  | 'high-only'
  | 'empty';

export function getReferenceRangeString(
  item: ClinicalDocument<BundleEntry<Observation>>,
): string | undefined {
  const text = fhirpath.evaluate(
    item.data_record.raw.resource,
    'referenceRange.text',
  )?.[0];
  const low = getReferenceRangeLow(item);
  const high = getReferenceRangeHigh(item);
  const unit = low?.unit ?? high?.unit;
  const unitSuffix = unit ? ` ${unit}` : '';

  const shape: ReferenceRangeShape = text
    ? 'text'
    : low?.value !== undefined && high?.value !== undefined
      ? 'bounded'
      : low?.value !== undefined
        ? 'low-only'
        : high?.value !== undefined
          ? 'high-only'
          : 'empty';

  switch (shape) {
    case 'text':
      return text;
    case 'bounded':
      return `${low.value} - ${high.value}${unitSuffix}`;
    case 'low-only':
      return `>= ${low.value}${unitSuffix}`;
    case 'high-only':
      return `<= ${high.value}${unitSuffix}`;
    case 'empty':
      return undefined;
  }
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

export function formatValueQuantity(
  observation: Observation | undefined,
): string | undefined {
  const quantity = observation?.valueQuantity;
  if (quantity?.value === undefined) {
    return undefined;
  }
  return `${quantity.comparator ?? ''}${quantity.value}`;
}

export function getValueQuantityString(
  item: ClinicalDocument<BundleEntry<Observation>>,
): string | undefined {
  return formatValueQuantity(item.data_record.raw.resource);
}

export function getValueString(
  item: ClinicalDocument<BundleEntry<Observation>>,
) {
  return fhirpath.evaluate(item.data_record.raw.resource, 'valueString')?.[0];
}

export function formatValueRange(
  observation: Observation | undefined,
): string | undefined {
  const low = observation?.valueRange?.low;
  const high = observation?.valueRange?.high;
  if (low?.value === undefined && high?.value === undefined) {
    return undefined;
  }
  const unit = low?.unit ?? high?.unit;
  const unitSuffix = unit ? ` ${unit}` : '';
  if (low?.value !== undefined && high?.value !== undefined) {
    return `${low.value} - ${high.value}${unitSuffix}`;
  }
  return low?.value !== undefined
    ? `>= ${low.value}${unitSuffix}`
    : `<= ${high?.value}${unitSuffix}`;
}

export function formatValueRatio(
  observation: Observation | undefined,
): string | undefined {
  const numerator = observation?.valueRatio?.numerator;
  const denominator = observation?.valueRatio?.denominator;
  if (numerator?.value === undefined || denominator?.value === undefined) {
    return undefined;
  }
  const unit = numerator.unit ?? denominator.unit;
  const unitSuffix = unit ? ` ${unit}` : '';
  return `${numerator.value}:${denominator.value}${unitSuffix}`;
}

export function getValueRangeString(
  item: ClinicalDocument<BundleEntry<Observation>>,
): string | undefined {
  return formatValueRange(item.data_record.raw.resource);
}

export function getValueRatioString(
  item: ClinicalDocument<BundleEntry<Observation>>,
): string | undefined {
  return formatValueRatio(item.data_record.raw.resource);
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
  const quantity = item.data_record.raw.resource?.valueQuantity;
  const value = quantity?.value;

  if (
    low === undefined ||
    high === undefined ||
    value === undefined ||
    isNaN(low) ||
    isNaN(high) ||
    isNaN(value)
  ) {
    return false;
  }

  // A comparator bounds the actual value on one side only, so flag only
  // when the result is certainly outside the range
  const comparator = quantity?.comparator;
  if (comparator === '<' || comparator === '<=') {
    return value <= low;
  }
  if (comparator === '>' || comparator === '>=') {
    return value >= high;
  }
  return value < low || value > high;
}
