import * as Cerner from './Cerner';
import * as R4 from './R4';

const connection = {
  id: 'connection-1',
  user_id: 'user-1',
  source: 'cerner',
  name: 'Cerner',
  location: 'https://cerner.example/',
  access_token: 'cerner-token',
  id_token: 'header.eyJmaGlyVXNlciI6IlBhdGllbnQvMTIzIn0.signature',
  fhir_version: 'R4',
} as any;

const r4DocumentReference = {
  resourceType: 'DocumentReference',
  id: 'document-1',
  date: '2024-03-04T05:06:07.000Z',
  type: { text: 'Clinical document' },
  content: [{ attachment: { url: 'https://files.example/report.xml' } }],
};

function response(body: unknown, contentType: string) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Type': contentType }),
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue('<ClinicalDocument />'),
    blob: jest.fn().mockResolvedValue(new Blob()),
  } as unknown as Response;
}

function routedFetch(routes: Record<string, () => Response>) {
  const empty = () =>
    response({ resourceType: 'Bundle' }, 'application/fhir+json');
  return jest.fn(async (input: RequestInfo | URL) =>
    (routes[input.toString()] ?? empty)(),
  ) as unknown as typeof globalThis.fetch;
}

function database(storedDocumentReference: unknown) {
  return {
    clinical_documents: {
      bulkUpsert: jest.fn().mockResolvedValue([]),
      find: jest
        .fn()
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([storedDocumentReference]),
        })
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      insert: jest.fn().mockResolvedValue(undefined),
    },
  } as any;
}

describe('document reference attachments', () => {
  afterEach(() => {
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('dates an R4 attachment from its document reference', async () => {
    const stored = {
      toMutableJSON: jest
        .fn()
        .mockReturnValue(
          R4.mapDocumentReferenceToClinicalDocument(
            { resource: r4DocumentReference } as any,
            connection,
          ),
        ),
    };
    const db = database(stored);
    globalThis.fetch = routedFetch({
      'https://cerner.example/DocumentReference?patient=123': () =>
        response(
          {
            resourceType: 'Bundle',
            entry: [{ resource: r4DocumentReference }],
          },
          'application/fhir+json',
        ),
      'https://files.example/report.xml': () => response({}, 'application/xml'),
    });

    await Cerner.syncAllRecords(
      'https://cerner.example/',
      connection,
      db,
      'R4',
    );

    expect(db.clinical_documents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          id: 'https://files.example/report.xml',
          date: '2024-03-04T05:06:07.000Z',
          display_name: 'Clinical document',
        }),
      }),
    );
  });
});

describe('R4 mapDocumentReferenceToClinicalDocument', () => {
  it('falls back to the context period when the document has no date', () => {
    const document = R4.mapDocumentReferenceToClinicalDocument(
      {
        resource: {
          resourceType: 'DocumentReference',
          id: 'document-2',
          context: { period: { start: '2023-01-02T03:04:05.000Z' } },
        },
      } as any,
      connection,
    );

    expect(document.metadata?.date).toBe('2023-01-02T03:04:05.000Z');
  });
});
