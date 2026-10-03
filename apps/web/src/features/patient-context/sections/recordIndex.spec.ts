import { BundleEntry, FhirResource } from 'fhir/r2';

import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
} from '../../../models/clinical-document/ClinicalDocument.type';
import { NoteRecord } from '../notes/noteRecord';
import { docsByType } from '../clinicalDocs';
import { buildRecordIndex } from './recordIndex';

function doc(
  resourceType: ClinicalDocumentResourceType,
  metadata: { id?: string; date?: string; display_name?: string },
  resource: Record<string, unknown>,
  options: { conn?: string; format?: 'FHIR.DSTU2' | 'FHIR.R4' } = {},
): ClinicalDocument<BundleEntry<FhirResource>> {
  return {
    id: `${options.conn ?? 'conn-a'}|user-1|${metadata.id ?? resourceType}`,
    connection_record_id: options.conn ?? 'conn-a',
    user_id: 'user-1',
    data_record: {
      raw: { resource } as never,
      format: options.format ?? 'FHIR.R4',
      content_type: 'application/json',
      resource_type: resourceType,
      version_history: [],
    },
    metadata,
  };
}

const noLocations = new Map<string, string>();

function build(
  docs: ClinicalDocument<BundleEntry<FhirResource>>[],
  overrides: {
    notes?: NoteRecord[];
    connectionLocations?: Map<string, string>;
  } = {},
) {
  return buildRecordIndex(
    docsByType(docs),
    overrides.connectionLocations ?? noLocations,
    overrides.notes ?? [],
  );
}

describe('buildRecordIndex', () => {
  it('renders coverage with its period and payer display, ongoing when no end date', () => {
    expect(
      build([
        doc(
          'coverage',
          { id: 'cov-1', date: '2021-02-01' },
          {
            status: 'active',
            type: { text: 'MANAGED CARE' },
            period: { start: '2021-02-01' },
            payor: [
              {
                reference: 'Organization/org-ox',
                display: 'Oxford Commercial',
              },
            ],
          },
        ),
      ]).entries,
    ).toEqual([
      {
        type: 'coverage',
        name: 'MANAGED CARE',
        date: { kind: 'known', iso: '2021-02-01' },
        dateLabel: '2021-02-01..present',
        facts: ['Oxford Commercial'],
      },
    ]);
  });

  it('resolves a display-less payor against organizations of the same connection only', () => {
    const orgInConnA = doc(
      'organization',
      {
        id: 'https://a.example/R4/Organization/org-1',
        date: '1970-01-01T00:00:00.000Z',
        display_name: 'United Healthcare',
      },
      {},
    );
    expect(
      build([
        doc(
          'coverage',
          { id: 'cov-2', date: '2015-01-01' },
          {
            status: 'active',
            type: { text: 'Managed Care - PPO' },
            period: { start: '2015-01-01', end: '2022-09-30' },
            payor: [{ reference: 'Organization/org-1' }],
          },
        ),
        doc(
          'coverage',
          { id: 'cov-3', date: '2010-01-01' },
          {
            status: 'active',
            type: { text: 'Managed Care - PPO' },
            period: { start: '2010-01-01', end: '2019-12-31' },
            payor: [{ reference: 'Organization/org-1' }],
          },
          { conn: 'conn-b' },
        ),
        orgInConnA,
      ]).entries,
    ).toEqual([
      {
        type: 'coverage',
        name: 'Managed Care - PPO',
        date: { kind: 'known', iso: '2015-01-01' },
        dateLabel: '2015-01-01..2022-09-30',
        facts: ['United Healthcare'],
      },
      {
        type: 'coverage',
        name: 'Managed Care - PPO',
        date: { kind: 'known', iso: '2010-01-01' },
        dateLabel: '2010-01-01..2019-12-31',
        facts: [],
      },
    ]);
  });

  it('renders appointments from their start time with status', () => {
    expect(
      build([
        doc(
          'appointment',
          {
            id: 'appt-1',
            date: '2026-09-14T12:00:00Z',
            display_name: 'WMC Employee Annual Assessment',
          },
          { status: 'booked', start: '2026-09-14T12:00:00Z' },
        ),
      ]).entries,
    ).toEqual([
      {
        type: 'appointment',
        name: 'WMC Employee Annual Assessment',
        date: { kind: 'known', iso: '2026-09-14T12:00:00Z' },
        facts: ['booked'],
      },
    ]);
  });

  it('renders procedures from performedDateTime with status', () => {
    expect(
      build([
        doc(
          'procedure',
          {
            id: 'proc-1',
            date: '2022-01-13T13:30:00-05:00',
            display_name: 'COLL VENOUS BLD VENIPUNCTURE',
          },
          {
            status: 'completed',
            performedDateTime: '2022-01-13T13:30:00-05:00',
          },
          { format: 'FHIR.DSTU2' },
        ),
      ]).entries,
    ).toEqual([
      {
        type: 'procedure',
        name: 'COLL VENOUS BLD VENIPUNCTURE',
        date: { kind: 'known', iso: '2022-01-13T13:30:00-05:00' },
        facts: ['completed'],
      },
    ]);
  });

  it('names a careteam by category when its display is the raw resource id, listing members', () => {
    expect(
      build([
        doc(
          'careteam',
          {
            id: 'ct-1',
            date: '1970-01-01T00:00:00.000Z',
            display_name: 'eWKcjuqZ8lAxm0nZ',
          },
          {
            id: 'eWKcjuqZ8lAxm0nZ',
            status: 'active',
            category: [
              { text: 'Longitudinal care-coordination focused care team' },
            ],
            participant: [
              {
                role: [{ text: 'Family Medicine' }],
                member: { display: 'Annabel Agcopra' },
              },
            ],
          },
        ),
      ]).entries,
    ).toEqual([
      {
        type: 'careteam',
        name: 'Longitudinal care-coordination focused care team',
        date: { kind: 'unknown' },
        facts: ['Annabel Agcopra (Family Medicine)'],
      },
    ]);
  });

  it('names a nameless careplan by category with its status', () => {
    expect(
      build([
        doc(
          'careplan',
          { id: 'cp-1', date: '1970-01-01T00:00:00.000Z' },
          { status: 'active', category: [{ text: 'Longitudinal' }] },
          { format: 'FHIR.DSTU2' },
        ),
      ]).entries,
    ).toEqual([
      {
        type: 'careplan',
        name: 'Longitudinal',
        date: { kind: 'unknown' },
        facts: ['active'],
      },
    ]);
  });

  it('renders servicerequests as orders with status and intent', () => {
    expect(
      build([
        doc(
          'servicerequest',
          {
            id: 'sr-1',
            date: '2023-06-26T19:53:54Z',
            display_name: 'HEPATITIS C ANTIBODY',
          },
          {
            status: 'active',
            intent: 'original-order',
            authoredOn: '2023-06-26T19:53:54Z',
          },
        ),
      ]).entries,
    ).toEqual([
      {
        type: 'order',
        name: 'HEPATITIS C ANTIBODY',
        date: { kind: 'known', iso: '2023-06-26T19:53:54Z' },
        facts: ['active', 'original-order'],
      },
    ]);
  });

  it('keeps diagnostic reports whose results are lab observations out of the report lane', () => {
    const index = build(
      [
        doc(
          'diagnosticreport',
          {
            id: 'dr-lab',
            date: '2023-03-14T00:00:00Z',
            display_name: 'CBC w/Automated Diff',
          },
          { result: [{ reference: 'Observation/obs-1' }] },
        ),
        doc(
          'diagnosticreport',
          {
            id: 'dr-lab-relative',
            date: '2022-03-17T00:00:00Z',
            display_name: 'HEPATITIS PANEL, GENERAL',
          },
          { result: [{ reference: 'Observation/L-245048065' }] },
        ),
        doc(
          'diagnosticreport',
          {
            id: 'dr-img',
            date: '2024-03-01T00:00:00Z',
            display_name: 'XR CHEST 2 VIEWS',
          },
          {},
        ),
        doc(
          'observation',
          {
            id: 'https://a.example/R4/Observation/obs-1',
            date: '2023-03-14T00:00:00Z',
            display_name: 'Hgb',
          },
          {},
        ),
        doc(
          'observation',
          {
            id: 'Observation/L-245048065',
            date: '2022-03-17T00:00:00Z',
            display_name: 'HBsAg',
          },
          {},
        ),
      ],
      {
        connectionLocations: new Map([['conn-a', 'https://a.example/R4']]),
      },
    );
    expect(index.entries).toEqual([
      {
        type: 'report',
        name: 'XR CHEST 2 VIEWS',
        date: { kind: 'known', iso: '2024-03-01T00:00:00Z' },
        facts: [],
      },
    ]);
    expect(index.alsoOnRecord).toEqual([]);
  });

  it('lists one report twice only when name and time are not both identical', () => {
    const index = build([
      doc(
        'diagnosticreport',
        { id: 'r1', date: '2023-03-14T16:48:00Z', display_name: 'CBC' },
        { resourceType: 'DiagnosticReport' },
        { conn: 'conn-a' },
      ),
      doc(
        'diagnosticreport',
        { id: 'r2', date: '2023-03-14T16:48:00Z', display_name: 'CBC' },
        { resourceType: 'DiagnosticReport' },
        { conn: 'conn-b' },
      ),
      doc(
        'diagnosticreport',
        { id: 'r3', date: '2023-03-14T09:05:00Z', display_name: 'CBC' },
        { resourceType: 'DiagnosticReport' },
        { conn: 'conn-a' },
      ),
      doc(
        'diagnosticreport',
        { id: 'r4', display_name: 'CBC' },
        { resourceType: 'DiagnosticReport' },
        { conn: 'conn-a' },
      ),
      doc(
        'diagnosticreport',
        { id: 'r5', display_name: 'CBC' },
        { resourceType: 'DiagnosticReport' },
        { conn: 'conn-b' },
      ),
    ]);
    expect(index.entries).toEqual([
      {
        type: 'report',
        name: 'CBC',
        date: { kind: 'known', iso: '2023-03-14T16:48:00Z' },
        facts: [],
      },
      {
        type: 'report',
        name: 'CBC',
        date: { kind: 'known', iso: '2023-03-14T09:05:00Z' },
        facts: [],
      },
      { type: 'report', name: 'CBC', date: { kind: 'unknown' }, facts: [] },
      { type: 'report', name: 'CBC', date: { kind: 'unknown' }, facts: [] },
    ]);
  });

  it('keeps a report another connection matches by the same relative observation id', () => {
    const index = build(
      [
        doc(
          'diagnosticreport',
          { id: 'rep-1', date: '2023-03-14T16:48:00Z', display_name: 'CBC' },
          {
            resourceType: 'DiagnosticReport',
            result: [{ reference: 'Observation/obs-1' }],
          },
          { conn: 'conn-b' },
        ),
        doc(
          'observation',
          {
            id: 'Observation/obs-1',
            date: '2023-03-14T16:48:00Z',
            display_name: 'WBC',
          },
          { resourceType: 'Observation', code: { text: 'WBC' } },
          { conn: 'conn-a' },
        ),
      ],
      {
        connectionLocations: new Map([
          ['conn-a', 'https://a.example.com'],
          ['conn-b', 'https://b.example.com'],
        ]),
      },
    );
    expect(index.entries).toEqual([
      {
        type: 'report',
        name: 'CBC',
        date: { kind: 'known', iso: '2023-03-14T16:48:00Z' },
        facts: [],
      },
    ]);
  });

  it('lists documents with the shared note alias', () => {
    const notes: NoteRecord[] = [
      {
        alias: 'n1',
        date: { kind: 'known', iso: '2025-11-10T00:00:00Z' },
        displayName: 'Progress Notes',
        contentType: 'application/xml',
        read: async () => ({ kind: 'text', format: 'ccda', text: 'x' }),
      },
      {
        alias: 'n2',
        date: { kind: 'known', iso: '2024-02-01T00:00:00Z' },
        displayName: 'Discharge Summary',
        contentType: 'application/pdf',
        read: async () => ({ kind: 'text', format: 'pdf', text: 'y' }),
      },
    ];
    expect(build([], { notes }).entries).toEqual([
      {
        type: 'document',
        name: 'Progress Notes',
        date: { kind: 'known', iso: '2025-11-10T00:00:00Z' },
        facts: ['read the text with read_note n1'],
      },
      {
        type: 'document',
        name: 'Discharge Summary',
        date: { kind: 'known', iso: '2024-02-01T00:00:00Z' },
        facts: ['read the text with read_note n2'],
      },
    ]);
  });

  it('folds all medication resource types into one entry per drug, newest wins', () => {
    expect(
      build([
        doc(
          'medicationstatement',
          {
            id: 'ms-1',
            date: '2024-01-01T00:00:00Z',
            display_name: 'Amoxicillin 500 mg capsule',
          },
          {},
        ),
        doc(
          'medicationdispense',
          {
            id: 'md-1',
            date: '2025-02-02T00:00:00Z',
            display_name: 'Amoxicillin 500 mg capsule',
          },
          {},
        ),
      ]).entries,
    ).toEqual([
      {
        type: 'medication',
        name: 'Amoxicillin 500 mg capsule',
        date: { kind: 'known', iso: '2025-02-02T00:00:00Z' },
        facts: [],
      },
    ]);
  });

  it('counts clinical types it cannot search and ignores infrastructure types', () => {
    const index = build([
      doc('familymemberhistory', { id: 'fmh-1', date: '2023-01-01' }, {}),
      doc('familymemberhistory', { id: 'fmh-2', date: '2023-01-01' }, {}),
      doc('provenance', { id: 'prov-1' }, {}),
      doc('patient', { id: 'pat-1' }, {}),
    ]);
    expect(index.entries).toEqual([]);
    expect(index.alsoOnRecord).toEqual([
      { type: 'familymemberhistory', count: 2 },
    ]);
  });
});
