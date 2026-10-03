import { BundleEntry, Observation } from 'fhir/r2';

import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { createTestClinicalDocument } from '../../../test-utils/clinicalDocumentTestData';
import { graphableLabs, sparklineValues } from './labTrend';

function observation(overrides: {
  id: string;
  date: string;
  value?: number;
  unit?: string;
  valueString?: string;
}): ClinicalDocument<BundleEntry<Observation>> {
  return createTestClinicalDocument({
    id: `conn-a|user-1|${overrides.id}`,
    data_record: {
      raw: {
        resource: {
          resourceType: 'Observation',
          code: { text: 'eGFR' },
          ...(overrides.value !== undefined
            ? {
                valueQuantity: { value: overrides.value, unit: overrides.unit },
              }
            : {}),
          ...(overrides.valueString
            ? { valueString: overrides.valueString }
            : {}),
        },
      } as never,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'observation',
      version_history: [],
    },
    metadata: { id: overrides.id, date: overrides.date, display_name: 'eGFR' },
  }) as ClinicalDocument<BundleEntry<Observation>>;
}

describe('graphableLabs', () => {
  it('keeps the numeric results and leaves out comments', () => {
    const latest = observation({
      id: 'a',
      date: '2025-11-10T20:39:00Z',
      value: 120,
      unit: 'mL/min/1.73m2',
    });
    const comment = observation({
      id: 'b',
      date: '2025-11-10T20:39:00Z',
      valueString: 'See Comment',
    });
    const earlier = observation({
      id: 'd',
      date: '2023-03-14T16:48:00Z',
      value: 95,
      unit: 'mL/min/1.73m2',
    });

    expect(graphableLabs([earlier, comment, latest])).toEqual([
      earlier,
      latest,
    ]);
  });
});

describe('sparklineValues', () => {
  it('lists the numeric value of each graphable result in order', () => {
    expect(
      sparklineValues([
        observation({
          id: 'd',
          date: '2023-03-14T16:48:00Z',
          value: 95,
          unit: 'mL/min/1.73m2',
        }),
        observation({
          id: 'a',
          date: '2025-11-10T20:39:00Z',
          value: 120,
          unit: 'mL/min/1.73m2',
        }),
      ]),
    ).toEqual([95, 120]);
  });
});
