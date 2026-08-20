import * as Athena from '../Athena';
import * as Cerner from '../Cerner';
import * as Epic from '../Epic';
import * as OnPatient from '../OnPatient';

function bundleResponse(bundle: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'application/fhir+json' }),
    json: jest.fn().mockResolvedValue(bundle),
    text: jest.fn().mockResolvedValue(''),
    blob: jest.fn().mockResolvedValue(new Blob()),
  } as unknown as Response;
}

function attachmentResponse(): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'application/xml' }),
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue('<ClinicalDocument />'),
    blob: jest.fn().mockResolvedValue(new Blob()),
  } as unknown as Response;
}

function routedFetch(routes: Record<string, () => Response> = {}) {
  const empty = () => bundleResponse({ resourceType: 'Bundle' });
  return jest.fn(async (input: RequestInfo | URL) =>
    (routes[input.toString()] ?? empty)(),
  ) as unknown as jest.MockedFunction<typeof globalThis.fetch>;
}

function emptyBundleFetch() {
  return routedFetch();
}

function pagedBundleFetch() {
  return routedFetch({
    'https://onpatient.com/api/fhir/Immunization': () =>
      bundleResponse({
        resourceType: 'Bundle',
        link: [
          {
            relation: 'next',
            url: 'https://onpatient.example/Immunization?page=2',
          },
        ],
      }),
  });
}

function cernerAttachmentFetch() {
  return routedFetch({
    'https://files.example/report.xml': attachmentResponse,
    'https://cerner.example/DocumentReference?patient=123': () =>
      bundleResponse({
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'DocumentReference',
              id: 'document-1',
              date: '2024-01-01T00:00:00.000Z',
              type: { text: 'Clinical document' },
              content: [
                { attachment: { url: 'https://files.example/report.xml' } },
              ],
            },
          },
        ],
      }),
  });
}

function createDatabase(documents: unknown[] = []) {
  return {
    clinical_documents: {
      bulkUpsert: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(documents),
      }),
      insert: jest.fn().mockResolvedValue(undefined),
    },
  } as any;
}

function createAttachmentDatabase() {
  return {
    clinical_documents: {
      bulkUpsert: jest.fn().mockResolvedValue([]),
      find: jest
        .fn()
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([cernerDocument]),
        })
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      insert: jest.fn().mockResolvedValue(undefined),
    },
  } as any;
}

function createEpicAttachmentDatabase(
  attachmentUrl = 'https://files.example/report.xml',
) {
  const epicDocument = {
    toMutableJSON: jest.fn().mockReturnValue({
      user_id: 'user-1',
      connection_record_id: 'epic-connection',
      data_record: {
        raw: {
          resource: {
            resourceType: 'DocumentReference',
            id: 'document-1',
            date: '2024-01-01T00:00:00.000Z',
            type: { text: 'Clinical document' },
            content: [{ attachment: { url: attachmentUrl } }],
          },
        },
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'documentreference',
        version_history: [],
      },
      metadata: {
        id: 'DocumentReference/document-1',
        date: '2024-01-01T00:00:00.000Z',
        display_name: 'Clinical document',
      },
    }),
  };

  return {
    clinical_documents: {
      bulkUpsert: jest.fn().mockResolvedValue([]),
      find: jest
        .fn()
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([epicDocument]),
        })
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      insert: jest.fn().mockResolvedValue(undefined),
    },
  } as any;
}

function createConnectionDocument(connection: unknown) {
  return {
    toMutableJSON: jest.fn().mockReturnValue(connection),
  } as any;
}

function epicContext(fhirVersion: string | undefined) {
  return {
    config: { PUBLIC_URL: 'https://app.example' },
    db: createDatabase(),
    connection: createConnectionDocument({
      id: 'epic-connection',
      user_id: 'user-1',
      source: 'epic',
      name: 'Epic',
      location: 'https://epic.example/api/FHIR/DSTU2/',
      access_token: 'epic-token',
      patient: 'patient-1',
      tenant_id: 'tenant-1',
      fhir_version: fhirVersion,
    }),
    document: {
      id: 'epic-connection',
      user_id: 'user-1',
      source: 'epic',
      name: 'Epic',
      location: 'https://epic.example/api/FHIR/DSTU2/',
      access_token: 'epic-token',
      patient: 'patient-1',
      tenant_id: 'tenant-1',
      fhir_version: fhirVersion,
    },
    fhirBaseUrl: 'https://epic.example/api/FHIR/DSTU2/',
    useProxy: false,
  } as any;
}

function cernerContext(fhirVersion: string | undefined, db = createDatabase()) {
  return {
    config: {},
    db,
    connection: createConnectionDocument({
      id: 'cerner-connection',
      user_id: 'user-1',
      source: 'cerner',
      name: 'Cerner',
      location: 'https://cerner.example/',
      access_token: 'cerner-token',
      id_token: 'header.eyJmaGlyVXNlciI6IlBhdGllbnQvMTIzIn0.signature',
      fhir_version: fhirVersion,
    }),
    document: {
      id: 'cerner-connection',
      user_id: 'user-1',
      source: 'cerner',
      name: 'Cerner',
      location: 'https://cerner.example/',
      access_token: 'cerner-token',
      id_token: 'header.eyJmaGlyVXNlciI6IlBhdGllbnQvMTIzIn0.signature',
      fhir_version: fhirVersion,
    },
    fhirBaseUrl: 'https://cerner.example/',
    useProxy: false,
  } as any;
}

function athenaContext() {
  return {
    config: {},
    db: createDatabase(),
    connection: createConnectionDocument({
      id: 'athena-connection',
      user_id: 'user-1',
      source: 'athena',
      name: 'Athena',
      location: 'https://athena.example/fhir',
      access_token: 'athena-token',
      patient: 'patient-1',
    }),
    document: {
      id: 'athena-connection',
      user_id: 'user-1',
      source: 'athena',
      name: 'Athena',
      location: 'https://athena.example/fhir',
      access_token: 'athena-token',
      patient: 'patient-1',
    },
    fhirBaseUrl: 'https://unused.example',
    useProxy: false,
  } as any;
}

function onPatientContext() {
  return {
    config: {},
    db: createDatabase(),
    connection: createConnectionDocument({
      id: 'onpatient-connection',
      user_id: 'user-1',
      source: 'onpatient',
      name: 'OnPatient',
      location: 'https://onpatient.com/api/fhir',
      access_token: 'onpatient-token',
    }),
    document: {
      id: 'onpatient-connection',
      user_id: 'user-1',
      source: 'onpatient',
      name: 'OnPatient',
      location: 'https://onpatient.com/api/fhir',
      access_token: 'onpatient-token',
    },
    fhirBaseUrl: 'https://onpatient.com/api/fhir',
    useProxy: false,
  } as any;
}

const cernerDocument = {
  toMutableJSON: jest.fn().mockReturnValue({
    user_id: 'user-1',
    connection_record_id: 'cerner-connection',
    data_record: {
      raw: {
        resource: {
          resourceType: 'DocumentReference',
          id: 'document-1',
          date: '2024-01-01T00:00:00.000Z',
          type: { text: 'Clinical document' },
          content: [
            { attachment: { url: 'https://files.example/report.xml' } },
          ],
        },
      },
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'documentreference',
      version_history: [],
    },
    metadata: {
      id: 'DocumentReference/document-1',
      date: '2024-01-01T00:00:00.000Z',
      display_name: 'Clinical document',
    },
  }),
};

describe('vendor sync fetch', () => {
  afterEach(() => {
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('uses Epic DSTU2 tasks when the version is missing', async () => {
    const fetch = emptyBundleFetch();
    globalThis.fetch = fetch;

    await Epic.sync.syncAllRecords(epicContext(undefined));

    expect(fetch).toHaveBeenCalledTimes(10);
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      'https://epic.example/api/FHIR/DSTU2/MedicationStatement?patient=patient-1',
      {
        headers: {
          Authorization: 'Bearer epic-token',
          Accept: 'application/fhir+json',
        },
      },
    );
  });

  it('fetches Epic records directly when no public url is configured', async () => {
    const fetch = emptyBundleFetch();
    globalThis.fetch = fetch;
    const context = epicContext(undefined);
    context.config = {};

    await Epic.sync.syncAllRecords(context);

    expect(fetch).toHaveBeenNthCalledWith(
      5,
      'https://epic.example/api/FHIR/DSTU2/MedicationStatement?patient=patient-1',
      {
        headers: {
          Authorization: 'Bearer epic-token',
          Accept: 'application/fhir+json',
        },
      },
    );
  });

  it('uses Epic DSTU2 tasks for an invalid version', async () => {
    const fetch = emptyBundleFetch();
    globalThis.fetch = fetch;

    await Epic.sync.syncAllRecords(epicContext('invalid'));

    expect(fetch).toHaveBeenCalledTimes(10);
    expect(fetch).toHaveBeenNthCalledWith(
      9,
      'https://epic.example/api/FHIR/DSTU2/DocumentReference?patient=patient-1',
      {
        headers: {
          Authorization: 'Bearer epic-token',
          Accept: 'application/fhir+json',
        },
      },
    );
    expect(fetch).toHaveBeenNthCalledWith(
      10,
      'https://epic.example/api/FHIR/DSTU2/CarePlan?patient=patient-1',
      {
        headers: {
          Authorization: 'Bearer epic-token',
          Accept: 'application/fhir+json',
        },
      },
    );
  });

  it('uses Cerner DSTU2 tasks when the version is missing', async () => {
    const fetch = emptyBundleFetch();
    globalThis.fetch = fetch;

    await Cerner.sync.syncAllRecords(cernerContext(undefined));

    expect(fetch).toHaveBeenCalledTimes(10);
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      'https://cerner.example/MedicationStatement?patient=123',
      {
        headers: {
          Authorization: 'Bearer cerner-token',
          Accept: 'application/json+fhir',
        },
      },
    );
  });

  it('uses Cerner DSTU2 tasks for an invalid version', async () => {
    const fetch = emptyBundleFetch();
    globalThis.fetch = fetch;

    await Cerner.sync.syncAllRecords(cernerContext('invalid'));

    expect(fetch).toHaveBeenCalledTimes(10);
    expect(fetch).toHaveBeenNthCalledWith(
      8,
      'https://cerner.example/DocumentReference?patient=123',
      {
        headers: {
          Authorization: 'Bearer cerner-token',
          Accept: 'application/json+fhir',
        },
      },
    );
    expect(fetch).toHaveBeenNthCalledWith(
      9,
      'https://cerner.example/Encounter?patient=123',
      {
        headers: {
          Authorization: 'Bearer cerner-token',
          Accept: 'application/json+fhir',
        },
      },
    );
  });

  it('requests Athena Encounter provenance includes', async () => {
    const fetch = emptyBundleFetch();
    globalThis.fetch = fetch;

    await Athena.sync.syncAllRecords(athenaContext());

    expect(fetch).toHaveBeenNthCalledWith(
      9,
      'https://athena.example/fhir/Encounter?patient=patient-1&_revinclude=Provenance%3Atarget',
      {
        headers: {
          Authorization: 'Bearer athena-token',
          Accept: 'application/fhir+json',
        },
      },
    );
  });

  it('follows pagination links', async () => {
    const fetch = pagedBundleFetch();
    globalThis.fetch = fetch;

    await OnPatient.sync.syncAllRecords(onPatientContext());

    expect(fetch).toHaveBeenCalledWith(
      'https://onpatient.example/Immunization?page=2',
      { headers: { Authorization: 'Bearer onpatient-token' } },
    );
  });

  it('withholds the Epic access token from an off-origin attachment', async () => {
    const fetch = routedFetch({
      'https://files.example/report.xml': attachmentResponse,
    });
    globalThis.fetch = fetch;
    const db = createEpicAttachmentDatabase();
    const context = epicContext(undefined);
    context.db = db;

    await Epic.sync.syncAllRecords(context);

    expect(fetch).toHaveBeenCalledWith('https://files.example/report.xml', {
      headers: {},
    });
  });

  it('sends the Epic access token to an in-base attachment', async () => {
    const fetch = routedFetch({
      'https://epic.example/api/FHIR/DSTU2/Binary/abc': attachmentResponse,
    });
    globalThis.fetch = fetch;
    const db = createEpicAttachmentDatabase(
      'https://epic.example/api/FHIR/DSTU2/Binary/abc',
    );
    const context = epicContext(undefined);
    context.db = db;

    await Epic.sync.syncAllRecords(context);

    expect(fetch).toHaveBeenCalledWith(
      'https://epic.example/api/FHIR/DSTU2/Binary/abc',
      { headers: { Authorization: 'Bearer epic-token' } },
    );
  });

  it('stores Cerner R4 document reference attachments', async () => {
    const fetch = cernerAttachmentFetch();
    globalThis.fetch = fetch;
    const db = createAttachmentDatabase();

    await Cerner.sync.syncAllRecords(cernerContext('R4', db));

    expect(fetch).toHaveBeenCalledWith('https://files.example/report.xml', {
      headers: {
        Authorization: 'Bearer cerner-token',
        Accept: '*/*',
      },
    });
    expect(db.clinical_documents.bulkUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        data_record: expect.objectContaining({ format: 'FHIR.R4' }),
      }),
    ]);
    expect(db.clinical_documents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        data_record: expect.objectContaining({
          raw: '<ClinicalDocument />',
          format: 'FHIR.R4',
          content_type: 'application/xml',
          resource_type: 'documentreference_attachment',
        }),
        metadata: expect.objectContaining({
          id: 'https://files.example/report.xml',
        }),
      }),
    );
  });
});
