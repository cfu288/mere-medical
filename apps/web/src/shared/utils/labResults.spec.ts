import { BundleEntry, Observation } from 'fhir/r2';

import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { createTestClinicalDocument } from '../../test-utils/clinicalDocumentTestData';
import {
  groupIdenticalLabRecords,
  labAnalyteKey,
  labValueText,
} from './labResults';

function observation(overrides: {
  id: string;
  connection: string;
  name: string;
  date: string;
  loinc?: string;
  value?: number;
  unit?: string;
  valueString?: string;
  resource?: Partial<Observation>;
}): ClinicalDocument<BundleEntry<Observation>> {
  return createTestClinicalDocument({
    id: `${overrides.connection}|user-1|${overrides.id}`,
    connection_record_id: overrides.connection,
    data_record: {
      raw: {
        resource: {
          resourceType: 'Observation',
          code: { text: overrides.name },
          ...(overrides.value !== undefined
            ? {
                valueQuantity: { value: overrides.value, unit: overrides.unit },
              }
            : {}),
          ...(overrides.valueString
            ? { valueString: overrides.valueString }
            : {}),
          ...overrides.resource,
        },
      } as never,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'observation',
      version_history: [],
    },
    metadata: {
      id: overrides.id,
      date: overrides.date,
      display_name: overrides.name,
      loinc_coding: overrides.loinc ? [overrides.loinc] : [],
    },
  }) as ClinicalDocument<BundleEntry<Observation>>;
}

describe('labAnalyteKey', () => {
  it('is the loinc code when there is one, otherwise the code text', () => {
    expect(
      labAnalyteKey(
        observation({
          id: 'a',
          connection: 'epic',
          name: 'Hgb',
          date: '2025-11-10T20:39:00Z',
          loinc: '718-7',
          value: 16,
        }),
      ),
    ).toEqual('718-7');
    expect(
      labAnalyteKey(
        observation({
          id: 'b',
          connection: 'epic',
          name: 'Lipid Panel, Standard',
          date: '2025-11-10T20:39:00Z',
          value: 184,
        }),
      ),
    ).toEqual('text:lipid panel, standard');
  });
});

describe('labValueText', () => {
  it('shows a quantity with its comparator', () => {
    const doc = observation({
      id: 'a',
      connection: 'epic',
      name: 'TSH',
      date: '2025-11-10T20:39:00Z',
      resource: {
        valueQuantity: { value: 0.5, comparator: '<', unit: 'mIU/L' },
      },
    });
    expect(labValueText(doc)).toEqual('<0.5');
  });

  it('has no text when the quantity carries a unit but no value', () => {
    const doc = observation({
      id: 'a',
      connection: 'epic',
      name: 'Glucose',
      date: '2025-11-10T20:39:00Z',
      resource: { valueQuantity: { unit: 'mg/dL' } },
    });
    expect(labValueText(doc)).toBeUndefined();
  });

  it('prefers the interpretation text over a value string, as the timeline row does', () => {
    const doc = observation({
      id: 'a',
      connection: 'epic',
      name: 'eGFR',
      date: '2025-11-10T20:39:00Z',
      valueString: 'See Comment',
      resource: { interpretation: { text: 'Normal' } },
    });
    expect(labValueText(doc)).toEqual('Normal');
  });
});

describe('groupIdenticalLabRecords', () => {
  it('never merges results without a loinc code, even when everything else matches', () => {
    const first = observation({
      id: 'cbc-1',
      connection: 'onpatient',
      name: 'CBC (INCLUDES DIFF/PLT)',
      date: '2022-01-13T13:41:00-05:00',
    });
    const second = observation({
      id: 'cbc-2',
      connection: 'onpatient',
      name: 'CBC (INCLUDES DIFF/PLT)',
      date: '2022-01-13T13:41:00-05:00',
    });

    expect(groupIdenticalLabRecords([first, second])).toEqual([
      [first],
      [second],
    ]);
  });

  it('keeps a comparator value apart from the plain value', () => {
    const below = observation({
      id: 'tsh-1',
      connection: 'epic',
      name: 'TSH',
      date: '2025-11-10T20:39:00Z',
      loinc: '3016-3',
      resource: {
        valueQuantity: { value: 0.5, comparator: '<', unit: 'mIU/L' },
      },
    });
    const exact = observation({
      id: 'tsh-2',
      connection: 'cerner',
      name: 'TSH',
      date: '2025-11-10T20:39:00Z',
      loinc: '3016-3',
      value: 0.5,
      unit: 'mIU/L',
    });

    expect(groupIdenticalLabRecords([below, exact])).toEqual([
      [below],
      [exact],
    ]);
  });

  it('keeps results apart when their units are spelled differently', () => {
    const lower = observation({
      id: 'glu-1',
      connection: 'epic',
      name: 'Glucose',
      date: '2025-11-10T20:39:00Z',
      loinc: '2345-7',
      value: 97,
      unit: 'mg/dL',
    });
    const upper = observation({
      id: 'glu-2',
      connection: 'quest',
      name: 'GLUCOSE',
      date: '2025-11-10T20:39:00Z',
      loinc: '2345-7',
      value: 97,
      unit: 'MG/DL',
    });

    expect(groupIdenticalLabRecords([lower, upper])).toEqual([
      [lower],
      [upper],
    ]);
  });

  it('keeps results apart when their reference ranges differ', () => {
    const wide = observation({
      id: 'hgb-1',
      connection: 'epic',
      name: 'Hgb',
      date: '2025-11-10T20:39:00Z',
      loinc: '718-7',
      value: 16,
      unit: 'g/dL',
      resource: {
        referenceRange: [{ low: { value: 13 }, high: { value: 17 } }],
      },
    });
    const narrow = observation({
      id: 'hgb-2',
      connection: 'cerner',
      name: 'Hemoglobin',
      date: '2025-11-10T20:39:00Z',
      loinc: '718-7',
      value: 16,
      unit: 'g/dL',
      resource: {
        referenceRange: [{ low: { value: 12 }, high: { value: 15.5 } }],
      },
    });

    expect(groupIdenticalLabRecords([wide, narrow])).toEqual([
      [wide],
      [narrow],
    ]);
  });

  it('keeps results apart when their interpretations differ', () => {
    const flagged = observation({
      id: 'hgb-1',
      connection: 'epic',
      name: 'Hgb',
      date: '2025-11-10T20:39:00Z',
      loinc: '718-7',
      value: 16,
      unit: 'g/dL',
      resource: {
        interpretation: {
          text: 'High',
          coding: [{ system: 'http://hl7.org/fhir/v2/0078', code: 'H' }],
        },
      },
    });
    const plain = observation({
      id: 'hgb-2',
      connection: 'cerner',
      name: 'Hemoglobin',
      date: '2025-11-10T20:39:00Z',
      loinc: '718-7',
      value: 16,
      unit: 'g/dL',
    });

    expect(groupIdenticalLabRecords([flagged, plain])).toEqual([
      [flagged],
      [plain],
    ]);
  });

  it('keeps apart an hl7 high flag and a vendor code that the timeline does not flag', () => {
    const hl7 = observation({
      id: 'hgb-1',
      connection: 'epic',
      name: 'Hgb',
      date: '2025-11-10T20:39:00Z',
      loinc: '718-7',
      value: 16,
      unit: 'g/dL',
      resource: {
        interpretation: {
          coding: [{ system: 'http://hl7.org/fhir/v2/0078', code: 'H' }],
        },
      },
    });
    const vendor = observation({
      id: 'hgb-2',
      connection: 'cerner',
      name: 'Hemoglobin',
      date: '2025-11-10T20:39:00Z',
      loinc: '718-7',
      value: 16,
      unit: 'g/dL',
      resource: {
        interpretation: {
          coding: [{ system: 'https://fhir.cerner.com/codeSet/52', code: 'H' }],
        },
      },
    });

    expect(groupIdenticalLabRecords([hl7, vendor])).toEqual([[hl7], [vendor]]);
  });

  it('keeps apart hl7 high and low flags that both read as abnormal', () => {
    const high = observation({
      id: 'k-1',
      connection: 'epic',
      name: 'Potassium',
      date: '2025-11-10T20:39:00Z',
      loinc: '2823-3',
      value: 4.1,
      unit: 'mmol/L',
      resource: {
        interpretation: {
          coding: [{ system: 'http://hl7.org/fhir/v2/0078', code: 'H' }],
        },
      },
    });
    const low = observation({
      id: 'k-2',
      connection: 'cerner',
      name: 'Potassium',
      date: '2025-11-10T20:39:00Z',
      loinc: '2823-3',
      value: 4.1,
      unit: 'mmol/L',
      resource: {
        interpretation: {
          coding: [{ system: 'http://hl7.org/fhir/v2/0078', code: 'L' }],
        },
      },
    });

    expect(groupIdenticalLabRecords([high, low])).toEqual([[high], [low]]);
  });

  it('merges one result whose interpretation two systems encode differently', () => {
    const dstu2 = observation({
      id: 'ldl-1',
      connection: 'epic',
      name: 'LDL CALC',
      date: '2025-11-10T20:39:00Z',
      loinc: '13457-7',
      value: 138,
      unit: 'mg/dL',
      resource: {
        interpretation: {
          text: 'High',
          coding: [
            {
              system: 'http://hl7.org/fhir/ValueSet/observation-interpretation',
              code: 'H',
              display: 'High',
            },
          ],
        },
      },
    });
    const r4 = observation({
      id: 'ldl-2',
      connection: 'cerner',
      name: 'LDL Calculated',
      date: '2025-11-10T20:39:00Z',
      loinc: '13457-7',
      value: 138,
      unit: 'mg/dL',
      resource: {
        interpretation: [
          {
            text: 'High',
            coding: [
              {
                system:
                  'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                code: 'H',
                display: 'High',
              },
            ],
          },
        ],
      },
    });

    expect(groupIdenticalLabRecords([dstu2, r4])).toEqual([[dstu2, r4]]);
  });

  it('keeps results apart when their comments differ', () => {
    const noted = observation({
      id: 'glu-1',
      connection: 'epic',
      name: 'Glucose',
      date: '2025-11-10T20:39:00Z',
      loinc: '2345-7',
      value: 97,
      unit: 'mg/dL',
      resource: { comments: 'Fasting specimen.' },
    });
    const bare = observation({
      id: 'glu-2',
      connection: 'quest',
      name: 'GLUCOSE',
      date: '2025-11-10T20:39:00Z',
      loinc: '2345-7',
      value: 97,
      unit: 'mg/dL',
    });

    expect(groupIdenticalLabRecords([noted, bare])).toEqual([[noted], [bare]]);
  });

  it('keeps same-named results with different loinc codes apart', () => {
    const serum = observation({
      id: 'glu-1',
      connection: 'epic',
      name: 'Glucose',
      date: '2025-11-10T20:39:00Z',
      loinc: '2345-7',
      value: 97,
      unit: 'mg/dL',
    });
    const wholeBlood = observation({
      id: 'glu-2',
      connection: 'epic',
      name: 'Glucose',
      date: '2025-11-10T20:39:00Z',
      loinc: '2339-0',
      value: 97,
      unit: 'mg/dL',
    });

    expect(groupIdenticalLabRecords([serum, wholeBlood])).toEqual([
      [serum],
      [wholeBlood],
    ]);
  });

  it('groups one result downloaded from two health systems, keeping both documents', () => {
    const epic = observation({
      id: 'wbc-1',
      connection: 'epic',
      name: 'LC- WBC UR',
      date: '2022-08-30T15:02:00Z',
      loinc: '5821-4',
      valueString: 'None seen',
    });
    const cerner = observation({
      id: 'wbc-2',
      connection: 'cerner',
      name: 'WBC, UA',
      date: '2022-08-30T15:02:00Z',
      loinc: '5821-4',
      valueString: 'None seen',
    });

    expect(groupIdenticalLabRecords([cerner, epic])).toEqual([[cerner, epic]]);
  });

  it('keeps results apart when their values differ at the same time', () => {
    const value = observation({
      id: 'egfr-1',
      connection: 'epic',
      name: 'eGFR',
      date: '2025-11-10T20:39:00Z',
      loinc: '77147-7',
      value: 120,
    });
    const comment = observation({
      id: 'egfr-2',
      connection: 'cerner',
      name: 'Est Glomerular Filtration Rate',
      date: '2025-11-10T20:39:00Z',
      loinc: '77147-7',
      valueString: 'See Comment',
    });

    expect(groupIdenticalLabRecords([value, comment])).toEqual([
      [value],
      [comment],
    ]);
  });

  it('keeps results apart when their units differ', () => {
    const grams = observation({
      id: 'hgb-1',
      connection: 'epic',
      name: 'Hgb',
      date: '2025-11-10T20:39:00Z',
      loinc: '718-7',
      value: 16,
      unit: 'g/dL',
    });
    const mmol = observation({
      id: 'hgb-2',
      connection: 'cerner',
      name: 'Hgb',
      date: '2025-11-10T20:39:00Z',
      loinc: '718-7',
      value: 16,
      unit: 'mmol/L',
    });

    expect(groupIdenticalLabRecords([grams, mmol])).toEqual([[grams], [mmol]]);
  });

  it('keeps a coded and an uncoded result apart even when everything else matches', () => {
    const coded = observation({
      id: 'hgb-1',
      connection: 'epic',
      name: 'Hemoglobin',
      date: '2025-11-10T20:39:00Z',
      loinc: '718-7',
      value: 16,
      unit: 'g/dL',
    });
    const uncoded = observation({
      id: 'hgb-2',
      connection: 'cerner',
      name: 'Hemoglobin',
      date: '2025-11-10T20:39:00Z',
      value: 16,
      unit: 'g/dL',
    });

    expect(groupIdenticalLabRecords([coded, uncoded])).toEqual([
      [coded],
      [uncoded],
    ]);
  });

  it('keeps same-day results at different times apart and orders groups oldest first', () => {
    const evening = observation({
      id: 'glu-2',
      connection: 'epic',
      name: 'Glucose',
      date: '2025-11-10T20:39:00Z',
      loinc: '2345-7',
      value: 97,
      unit: 'mg/dL',
    });
    const morning = observation({
      id: 'glu-1',
      connection: 'epic',
      name: 'Glucose',
      date: '2025-11-10T08:15:00Z',
      loinc: '2345-7',
      value: 97,
      unit: 'mg/dL',
    });

    expect(groupIdenticalLabRecords([evening, morning])).toEqual([
      [morning],
      [evening],
    ]);
  });

  it('keeps results with no value', () => {
    const panel = observation({
      id: 'cbc',
      connection: 'quest',
      name: 'CBC (INCLUDES DIFF/PLT)',
      date: '2022-01-13T13:41:00-05:00',
    });

    expect(groupIdenticalLabRecords([panel])).toEqual([[panel]]);
  });
});
