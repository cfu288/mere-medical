import { BundleEntry, Observation } from 'fhir/r2';

import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { createTestClinicalDocument } from '../../../test-utils/clinicalDocumentTestData';
import { graphableLabs, sparklineValues, unplotted } from './labTrend';

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
  it("keeps the numeric results in the row's unit and leaves out comments and other units", () => {
    const row = observation({
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
    const other = observation({
      id: 'c',
      date: '2024-05-01T09:00:00Z',
      value: 1.1,
      unit: 'mg/dL',
    });
    const earlier = observation({
      id: 'd',
      date: '2023-03-14T16:48:00Z',
      value: 95,
      unit: 'mL/min/1.73m2',
    });

    expect(graphableLabs(row, [earlier, other, comment, row])).toEqual([
      earlier,
      row,
    ]);
  });
});

describe('unplotted', () => {
  it('counts the numeric results left out of the graph by unit', () => {
    const row = observation({
      id: 'a',
      date: '2025-11-10T20:39:00Z',
      value: 97,
      unit: 'mg/dL',
    });
    const mmol1 = observation({
      id: 'b',
      date: '2024-05-01T09:00:00Z',
      value: 5.4,
      unit: 'mmol/L',
    });
    const mmol2 = observation({
      id: 'c',
      date: '2023-03-14T16:48:00Z',
      value: 5.1,
      unit: 'mmol/L',
    });
    const unitless = observation({
      id: 'd',
      date: '2022-01-13T13:41:00Z',
      value: 99,
    });
    const comment = observation({
      id: 'e',
      date: '2021-01-13T13:41:00Z',
      valueString: 'See Comment',
    });

    expect(unplotted(row, [row, mmol1, mmol2, unitless, comment])).toEqual([
      { unit: 'mmol/L', count: 2 },
      { unit: 'no unit', count: 1 },
    ]);
  });

  it('is empty when every numeric result shares the row unit', () => {
    const row = observation({
      id: 'a',
      date: '2025-11-10T20:39:00Z',
      value: 97,
      unit: 'mg/dL',
    });
    expect(unplotted(row, [row])).toEqual([]);
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
