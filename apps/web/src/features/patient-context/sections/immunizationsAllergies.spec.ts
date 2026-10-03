import { createTestClinicalDocument } from '../../../test-utils/clinicalDocumentTestData';
import {
  buildAllergyEntries,
  buildImmunizationEntries,
} from './immunizationsAllergies';

describe('buildImmunizationEntries', () => {
  it('merges differently named records sharing a cvx code', () => {
    const hepBAdult = createTestClinicalDocument({
      id: 'conn-a|user-1|imm-a',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Immunization',
            vaccineCode: {
              text: 'Hep B, adult',
              coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: '43' }],
            },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'immunization',
        version_history: [],
      },
      metadata: {
        id: 'imm-a',
        date: '2022-04-28T00:00:00Z',
        display_name: 'Hep B, adult',
      },
    });
    const hepatitisB = createTestClinicalDocument({
      id: 'conn-b|user-1|imm-b',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Immunization',
            vaccineCode: {
              text: 'Hepatitis B',
              coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: '43' }],
            },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'immunization',
        version_history: [],
      },
      metadata: {
        id: 'imm-b',
        date: '2022-03-20T00:00:00Z',
        display_name: 'Hepatitis B',
      },
    });
    expect(buildImmunizationEntries([hepatitisB, hepBAdult])).toEqual([
      {
        type: 'immunization',
        name: 'Hep B, adult',
        date: { kind: 'known', iso: '2022-04-28T00:00:00Z' },
        facts: ['doses: 2022-04-28, 2022-03-20'],
      },
    ]);
  });

  it('collapses repeat vaccines by name into one entry with every date, newest first', () => {
    const flu2024 = createTestClinicalDocument({
      id: 'conn-a|user-1|imm-1',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Immunization',
            vaccineCode: { text: 'Influenza vaccine' },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'immunization',
        version_history: [],
      },
      metadata: { id: 'imm-1', date: '2024-10-01T00:00:00Z' },
    });
    const flu2025 = createTestClinicalDocument({
      id: 'conn-a|user-1|imm-2',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Immunization',
            vaccineCode: { text: 'influenza vaccine' },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'immunization',
        version_history: [],
      },
      metadata: { id: 'imm-2', date: '2025-10-12T00:00:00Z' },
    });
    expect(buildImmunizationEntries([flu2024, flu2025])).toEqual([
      {
        type: 'immunization',
        name: 'influenza vaccine',
        date: { kind: 'known', iso: '2025-10-12T00:00:00Z' },
        facts: ['doses: 2025-10-12, 2024-10-01'],
      },
    ]);
  });

  it('leaves out vaccines that were not given or were entered in error', () => {
    const given = createTestClinicalDocument({
      id: 'conn-a|user-1|imm-g',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Immunization',
            status: 'completed',
            vaccineCode: { text: 'Influenza vaccine' },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'immunization',
        version_history: [],
      },
      metadata: { id: 'imm-g', date: '2024-10-01T00:00:00Z' },
    });
    const refused = createTestClinicalDocument({
      id: 'conn-a|user-1|imm-r',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Immunization',
            status: 'not-done',
            vaccineCode: { text: 'Influenza vaccine' },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'immunization',
        version_history: [],
      },
      metadata: { id: 'imm-r', date: '2025-10-12T00:00:00Z' },
    });
    const mistaken = createTestClinicalDocument({
      id: 'conn-a|user-1|imm-e',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Immunization',
            status: 'entered-in-error',
            vaccineCode: { text: 'Influenza vaccine' },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'immunization',
        version_history: [],
      },
      metadata: { id: 'imm-e', date: '2023-10-12T00:00:00Z' },
    });
    const notGiven = createTestClinicalDocument({
      id: 'conn-a|user-1|imm-n',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Immunization',
            wasNotGiven: true,
            vaccineCode: { text: 'Influenza vaccine' },
          },
        } as never,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'immunization',
        version_history: [],
      },
      metadata: { id: 'imm-n', date: '2022-10-12T00:00:00Z' },
    });
    expect(
      buildImmunizationEntries([given, refused, mistaken, notGiven]),
    ).toEqual([
      {
        type: 'immunization',
        name: 'Influenza vaccine',
        date: { kind: 'known', iso: '2024-10-01T00:00:00Z' },
        facts: [],
      },
    ]);
  });

  it('falls back to vaccineCode coding display when text is missing', () => {
    const doc = createTestClinicalDocument({
      id: 'conn-a|user-1|imm-3',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Immunization',
            vaccineCode: { coding: [{ display: 'Tdap' }] },
          },
        } as never,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'immunization',
        version_history: [],
      },
      metadata: { id: 'imm-3', date: '2022-08-01T00:00:00Z' },
    });
    expect(buildImmunizationEntries([doc])).toEqual([
      {
        type: 'immunization',
        name: 'Tdap',
        date: { kind: 'known', iso: '2022-08-01T00:00:00Z' },
        facts: [],
      },
    ]);
  });
});

describe('buildAllergyEntries', () => {
  it('drops placeholders and strips trailing asterisks', () => {
    const placeholder = createTestClinicalDocument({
      id: 'conn-a|user-1|all-p',
      data_record: {
        raw: {
          resource: {
            resourceType: 'AllergyIntolerance',
            substance: { text: 'Not on File' },
          },
        } as never,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'allergyintolerance',
        version_history: [],
      },
      metadata: { id: 'all-p', date: '1970-01-01T00:00:00.000Z' },
    });
    const soy = createTestClinicalDocument({
      id: 'conn-a|user-1|all-s',
      data_record: {
        raw: {
          resource: {
            resourceType: 'AllergyIntolerance',
            substance: { text: 'SOY ALLERGY**' },
          },
        } as never,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'allergyintolerance',
        version_history: [],
      },
      metadata: { id: 'all-s', date: '2023-03-14T00:00:00Z' },
    });
    expect(buildAllergyEntries([placeholder, soy])).toEqual([
      {
        type: 'allergy',
        name: 'SOY ALLERGY',
        date: { kind: 'known', iso: '2023-03-14T00:00:00Z' },
        facts: [],
      },
    ]);
  });

  it('maps a DSTU2 allergy by substance text', () => {
    const doc = createTestClinicalDocument({
      id: 'conn-a|user-1|all-1',
      data_record: {
        raw: {
          resource: {
            resourceType: 'AllergyIntolerance',
            substance: { text: 'Penicillin' },
          },
        } as never,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'allergyintolerance',
        version_history: [],
      },
      metadata: { id: 'all-1', date: '2018-05-01T00:00:00Z' },
    });
    expect(buildAllergyEntries([doc])).toEqual([
      {
        type: 'allergy',
        name: 'Penicillin',
        date: { kind: 'known', iso: '2018-05-01T00:00:00Z' },
        facts: [],
      },
    ]);
  });
});
