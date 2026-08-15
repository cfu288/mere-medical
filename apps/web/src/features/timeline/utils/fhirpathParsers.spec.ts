import { BundleEntry, Observation } from 'fhir/r2';

import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import {
  getReferenceRangeString,
  getValueRangeString,
  getValueRatioString,
} from './fhirpathParsers';

function makeObservation(
  resource: Partial<Observation>,
): ClinicalDocument<BundleEntry<Observation>> {
  return {
    data_record: {
      raw: { resource: { resourceType: 'Observation', ...resource } },
    },
  } as unknown as ClinicalDocument<BundleEntry<Observation>>;
}

describe('getReferenceRangeString', () => {
  it('returns the text field when present', () => {
    const item = makeObservation({
      referenceRange: [
        {
          low: { value: 12.3, unit: 'gm/dL' },
          high: { value: 17, unit: 'gm/dL' },
          text: '12.3 - 17.0 gm/dL',
        },
      ],
    });
    expect(getReferenceRangeString(item)).toEqual('12.3 - 17.0 gm/dL');
  });

  it('builds a range string from structured low/high when text is missing', () => {
    // Shape seen in Epic R4-sourced observations: structured low/high with a
    // type coding but no text field
    const item = makeObservation({
      referenceRange: [
        {
          low: {
            value: 12.3,
            unit: 'g/dL',
            system: 'http://unitsofmeasure.org',
            code: 'g/dL',
          },
          high: {
            value: 16,
            unit: 'g/dL',
            system: 'http://unitsofmeasure.org',
            code: 'g/dL',
          },
          type: { text: 'Normal Range' },
        } as never,
      ],
    });
    expect(getReferenceRangeString(item)).toEqual('12.3 - 16 g/dL');
  });

  it('builds a lower-bound-only string when only low is present', () => {
    const item = makeObservation({
      referenceRange: [{ low: { value: 60, unit: 'mL/min' } }],
    });
    expect(getReferenceRangeString(item)).toEqual('>= 60 mL/min');
  });

  it('builds an upper-bound-only string when only high is present', () => {
    const item = makeObservation({
      referenceRange: [{ high: { value: 200, unit: 'mg/dL' } }],
    });
    expect(getReferenceRangeString(item)).toEqual('<= 200 mg/dL');
  });

  it('omits the unit when low/high have no unit', () => {
    const item = makeObservation({
      referenceRange: [{ low: { value: 0 }, high: { value: 5 } }],
    });
    expect(getReferenceRangeString(item)).toEqual('0 - 5');
  });

  it('returns undefined when there is no referenceRange', () => {
    const item = makeObservation({});
    expect(getReferenceRangeString(item)).toBeUndefined();
  });
});

describe('getValueRangeString', () => {
  it('builds a range string from low and high', () => {
    const item = makeObservation({
      valueRange: {
        low: { value: 1, unit: 'mg/dL' },
        high: { value: 5, unit: 'mg/dL' },
      },
    });
    expect(getValueRangeString(item)).toEqual('1 - 5 mg/dL');
  });

  it('builds a lower-bound-only string when only low is present', () => {
    const item = makeObservation({
      valueRange: { low: { value: 1, unit: 'mg/dL' } },
    });
    expect(getValueRangeString(item)).toEqual('>= 1 mg/dL');
  });

  it('builds an upper-bound-only string when only high is present', () => {
    const item = makeObservation({
      valueRange: { high: { value: 5 } },
    });
    expect(getValueRangeString(item)).toEqual('<= 5');
  });

  it('returns undefined when there is no valueRange', () => {
    const item = makeObservation({});
    expect(getValueRangeString(item)).toBeUndefined();
  });
});

describe('getValueRatioString', () => {
  it('builds a ratio string from numerator and denominator', () => {
    const item = makeObservation({
      valueRatio: {
        numerator: { value: 1 },
        denominator: { value: 64 },
      },
    });
    expect(getValueRatioString(item)).toEqual('1:64');
  });

  it('includes the unit when present', () => {
    const item = makeObservation({
      valueRatio: {
        numerator: { value: 50, unit: 'mg' },
        denominator: { value: 1 },
      },
    });
    expect(getValueRatioString(item)).toEqual('50:1 mg');
  });

  it('returns undefined when either side is missing', () => {
    const item = makeObservation({
      valueRatio: { numerator: { value: 1 } },
    });
    expect(getValueRatioString(item)).toBeUndefined();
  });
});
