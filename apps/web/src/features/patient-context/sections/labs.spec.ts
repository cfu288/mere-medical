import { BundleEntry, FhirResource } from 'fhir/r2';

import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { createTestClinicalDocument } from '../../../test-utils/clinicalDocumentTestData';
import { docsByType } from '../clinicalDocs';
import { buildLabIndex } from './labs';

function observation(overrides: {
  id: string;
  metadataId: string;
  name: string;
  date: string;
  loinc?: string[];
  resource: Record<string, unknown>;
  connection?: string;
}): ClinicalDocument<BundleEntry<FhirResource>> {
  return createTestClinicalDocument({
    id: overrides.id,
    connection_record_id: overrides.connection ?? 'test-connection',
    data_record: {
      raw: {
        resource: { resourceType: 'Observation', ...overrides.resource },
      } as never,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'observation',
      version_history: [],
    },
    metadata: {
      id: overrides.metadataId,
      date: overrides.date,
      display_name: overrides.name,
      loinc_coding: overrides.loinc ?? [],
    },
  });
}

describe('buildLabIndex', () => {
  it('groups results by loinc code, newest first with undated results last, naming every form seen', () => {
    const index = buildLabIndex(
      docsByType([
        observation({
          id: 'conn-a|user-1|obs-20',
          metadataId: 'https://ehr.example.com/fhir/Observation/obs-20',
          name: 'Hgb',
          date: '2023-03-14T16:48:00Z',
          loinc: ['718-7'],
          resource: {
            code: { text: 'Hgb' },
            valueQuantity: { value: 16, unit: 'g/dL' },
          },
        }),
        observation({
          id: 'conn-a|user-1|obs-21',
          metadataId: 'https://ehr.example.com/fhir/Observation/obs-21',
          name: 'Hemoglobin',
          date: '1970-01-01T00:00:00.000Z',
          loinc: ['718-7'],
          resource: {
            code: { text: 'Hemoglobin' },
            valueQuantity: { value: 15.2, unit: 'g/dL' },
          },
        }),
        observation({
          id: 'conn-a|user-1|obs-22',
          metadataId: 'https://ehr.example.com/fhir/Observation/obs-22',
          name: 'Hgb',
          date: '2025-11-10T20:39:00Z',
          loinc: ['718-7'],
          resource: {
            code: { text: 'Hgb' },
            valueQuantity: { value: 16.1, unit: 'g/dL' },
          },
        }),
      ]),
      new Map(),
    );
    expect(index).toEqual([
      {
        names: ['Hgb', 'Hemoglobin'],
        code: '718-7',
        panelNames: [],
        results: [
          {
            display: '16.1',
            unit: 'g/dL',
            abnormal: false,
            date: { kind: 'known', iso: '2025-11-10T20:39:00Z' },
          },
          {
            display: '16',
            unit: 'g/dL',
            abnormal: false,
            date: { kind: 'known', iso: '2023-03-14T16:48:00Z' },
          },
          {
            display: '15.2',
            unit: 'g/dL',
            abnormal: false,
            date: { kind: 'unknown' },
          },
        ],
      },
    ]);
  });

  it('lists one result downloaded from two health systems once, under both names', () => {
    const index = buildLabIndex(
      docsByType([
        observation({
          id: 'conn-a|user-1|obs-1',
          metadataId: 'https://a.example.com/fhir/Observation/obs-1',
          name: 'LC- WBC UR',
          date: '2022-08-30T15:02:00Z',
          loinc: ['5821-4'],
          resource: { code: { text: 'LC- WBC UR' }, valueString: 'None seen' },
        }),
        observation({
          id: 'conn-b|user-1|obs-2',
          metadataId: 'https://b.example.com/fhir/Observation/obs-2',
          name: 'WBC, UA',
          date: '2022-08-30T15:02:00Z',
          loinc: ['5821-4'],
          resource: { code: { text: 'WBC, UA' }, valueString: 'None seen' },
        }),
      ]),
      new Map(),
    );
    expect(index).toEqual([
      {
        names: ['LC- WBC UR', 'WBC, UA'],
        code: '5821-4',
        panelNames: [],
        results: [
          {
            display: 'None seen',
            unit: undefined,
            abnormal: false,
            date: { kind: 'known', iso: '2022-08-30T15:02:00Z' },
          },
        ],
      },
    ]);
  });

  it('keeps every result when two systems disagree about one draw', () => {
    const index = buildLabIndex(
      docsByType([
        observation({
          id: 'conn-a|user-1|obs-1',
          metadataId: 'https://a.example.com/fhir/Observation/obs-1',
          name: 'eGFR',
          date: '2025-11-10T20:39:00Z',
          loinc: ['77147-7'],
          resource: { code: { text: 'eGFR' }, valueQuantity: { value: 120 } },
        }),
        observation({
          id: 'conn-b|user-1|obs-2',
          metadataId: 'https://b.example.com/fhir/Observation/obs-2',
          name: 'Est Glomerular Filtration Rate',
          date: '2025-11-10T20:39:00Z',
          loinc: ['77147-7'],
          resource: {
            code: { text: 'Est Glomerular Filtration Rate' },
            valueString: 'See Comment',
          },
        }),
      ]),
      new Map(),
    );
    expect(index.map((entry) => entry.results.map((r) => r.display))).toEqual([
      ['120', 'See Comment'],
    ]);
  });

  it('keeps uncoded results under their own code text and shows a result with no value', () => {
    const index = buildLabIndex(
      docsByType([
        observation({
          id: 'conn-q|user-1|obs-1',
          metadataId: 'https://q.example.com/fhir/Observation/obs-1',
          name: 'LIPID PANEL, STANDARD',
          date: '2022-01-13T13:41:00-05:00',
          resource: {
            code: { text: 'LIPID PANEL, STANDARD' },
            valueQuantity: { value: 184, unit: 'mg/dL' },
          },
        }),
        observation({
          id: 'conn-q|user-1|obs-2',
          metadataId: 'https://q.example.com/fhir/Observation/obs-2',
          name: 'LIPID PANEL, STANDARD',
          date: '2022-01-13T13:41:00-05:00',
          resource: { code: { text: 'LIPID PANEL, STANDARD' } },
        }),
      ]),
      new Map(),
    );
    expect(index).toEqual([
      {
        names: ['LIPID PANEL, STANDARD'],
        code: undefined,
        panelNames: [],
        results: [
          {
            display: '184',
            unit: 'mg/dL',
            abnormal: false,
            date: { kind: 'known', iso: '2022-01-13T13:41:00-05:00' },
          },
          {
            display: 'no value',
            unit: undefined,
            abnormal: false,
            date: { kind: 'known', iso: '2022-01-13T13:41:00-05:00' },
          },
        ],
      },
    ]);
  });

  it('names the panel when the health system stores the result under the relative id the report uses', () => {
    const report = createTestClinicalDocument({
      id: 'test-connection|test-user|rep-1',
      data_record: {
        raw: {
          resource: {
            resourceType: 'DiagnosticReport',
            result: [{ reference: 'Observation/obs-7' }],
          },
        } as never,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'diagnosticreport',
        version_history: [],
      },
      metadata: {
        id: 'DiagnosticReport/rep-1',
        date: '2022-01-13T13:41:00-05:00',
        display_name: 'CBC (INCLUDES DIFF/PLT)',
      },
    });
    const index = buildLabIndex(
      docsByType([
        report,
        observation({
          id: 'test-connection|test-user|Observation/obs-7',
          metadataId: 'Observation/obs-7',
          name: 'WBC',
          date: '2022-01-13T13:41:00-05:00',
          loinc: ['6690-2'],
          resource: {
            code: { text: 'WBC' },
            valueQuantity: { value: 6.2, unit: 'x10E3/uL' },
          },
        }),
      ]),
      new Map([['test-connection', 'https://onpatient.com']]),
    );
    expect(index.map((entry) => entry.panelNames)).toEqual([
      ['CBC (INCLUDES DIFF/PLT)'],
    ]);
  });

  it('does not borrow a panel name from another connection that reuses the relative id', () => {
    const report = createTestClinicalDocument({
      id: 'conn-b|test-user|rep-1',
      connection_record_id: 'conn-b',
      data_record: {
        raw: {
          resource: {
            resourceType: 'DiagnosticReport',
            result: [{ reference: 'Observation/obs-7' }],
          },
        } as never,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'diagnosticreport',
        version_history: [],
      },
      metadata: {
        id: 'DiagnosticReport/rep-1',
        date: '2022-01-13T13:41:00-05:00',
        display_name: 'CBC (INCLUDES DIFF/PLT)',
      },
    });
    const index = buildLabIndex(
      docsByType([
        report,
        observation({
          id: 'conn-a|test-user|Observation/obs-7',
          connection: 'conn-a',
          metadataId: 'Observation/obs-7',
          name: 'WBC',
          date: '2022-01-13T13:41:00-05:00',
          loinc: ['6690-2'],
          resource: {
            code: { text: 'WBC' },
            valueQuantity: { value: 6.2, unit: 'x10E3/uL' },
          },
        }),
      ]),
      new Map([
        ['conn-a', 'https://a.example.com'],
        ['conn-b', 'https://onpatient.com'],
      ]),
    );
    expect(index.map((entry) => entry.panelNames)).toEqual([[]]);
  });

  it('ignores report references that point nowhere or repeat', () => {
    const report = createTestClinicalDocument({
      id: 'test-connection|test-user|rep-1',
      data_record: {
        raw: {
          resource: {
            resourceType: 'DiagnosticReport',
            result: [
              { reference: 'Observation/missing' },
              { reference: 'Observation/obs-20' },
              { reference: 'Observation/obs-20' },
              {},
            ],
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'diagnosticreport',
        version_history: [],
      },
      metadata: {
        id: 'rep-1',
        date: '2023-03-14T16:48:00Z',
        display_name: 'CBC w/Automated Diff (Final Result)',
      },
    });
    const index = buildLabIndex(
      docsByType([
        report,
        observation({
          id: 'test-connection|test-user|obs-20',
          metadataId: 'https://ehr.example.com/fhir/Observation/obs-20',
          name: 'Hgb',
          date: '2023-03-14T16:48:00Z',
          loinc: ['718-7'],
          resource: {
            code: { text: 'Hgb' },
            valueQuantity: { value: 16, unit: 'g/dL' },
          },
        }),
      ]),
      new Map([['test-connection', 'https://ehr.example.com/fhir']]),
    );
    expect(index.map((entry) => entry.panelNames)).toEqual([
      ['CBC w/Automated Diff (Final Result)'],
    ]);
  });

  it('flags a result abnormal when any copy of it is flagged', () => {
    const index = buildLabIndex(
      docsByType([
        observation({
          id: 'conn-a|user-1|obs-1',
          metadataId: 'https://a.example.com/fhir/Observation/obs-1',
          name: 'Hgb',
          date: '2025-11-10T20:39:00Z',
          loinc: ['718-7'],
          resource: {
            code: { text: 'Hgb' },
            valueQuantity: { value: 18.2, unit: 'g/dL' },
          },
        }),
        observation({
          id: 'conn-b|user-1|obs-2',
          metadataId: 'https://b.example.com/fhir/Observation/obs-2',
          name: 'Hemoglobin',
          date: '2025-11-10T20:39:00Z',
          loinc: ['718-7'],
          resource: {
            code: { text: 'Hemoglobin' },
            valueQuantity: { value: 18.2, unit: 'g/dL' },
            referenceRange: [
              {
                low: { value: 13, unit: 'g/dL' },
                high: { value: 17, unit: 'g/dL' },
              },
            ],
          },
        }),
      ]),
      new Map(),
    );
    expect(index).toEqual([
      {
        names: ['Hgb', 'Hemoglobin'],
        code: '718-7',
        panelNames: [],
        results: [
          {
            display: '18.2',
            unit: 'g/dL',
            abnormal: true,
            date: { kind: 'known', iso: '2025-11-10T20:39:00Z' },
          },
        ],
      },
    ]);
  });

  it('names the panel a diagnostic report files a result under', () => {
    const report = createTestClinicalDocument({
      id: 'conn-a|user-1|rep-1',
      data_record: {
        raw: {
          resource: {
            resourceType: 'DiagnosticReport',
            result: [{ reference: 'Observation/obs-20' }],
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'diagnosticreport',
        version_history: [],
      },
      metadata: {
        id: 'rep-1',
        date: '2023-03-14T16:48:00Z',
        display_name: 'CBC w/Automated Diff (Final Result)',
      },
    });
    const index = buildLabIndex(
      docsByType([
        report,
        observation({
          id: 'conn-a|user-1|obs-20',
          metadataId: 'https://ehr.example.com/fhir/Observation/obs-20',
          name: 'Hgb',
          date: '2023-03-14T16:48:00Z',
          loinc: ['718-7'],
          resource: {
            code: { text: 'Hgb' },
            valueQuantity: { value: 16, unit: 'g/dL' },
          },
        }),
      ]),
      new Map([['test-connection', 'https://ehr.example.com/fhir']]),
    );
    expect(index.map((entry) => entry.panelNames)).toEqual([
      ['CBC w/Automated Diff (Final Result)'],
    ]);
  });
});
