import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../../app/providers/DatabaseCollections';
import { ConnectionDocument } from '../../../../models/connection-document/ConnectionDocument.type';
import { UserDocument } from '../../../../models/user-document/UserDocument.type';
import { createTestClinicalDocument } from '../../../../test-utils/clinicalDocumentTestData';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../../test-utils/createTestDatabase';
import { getRelatedDocuments } from './DiagnosticReportCard';

const user = { id: 'user-1' } as UserDocument;

function report(reference: string) {
  return createTestClinicalDocument({
    id: 'conn-a|user-1|report-1',
    connection_record_id: 'conn-a',
    user_id: 'user-1',
    data_record: {
      raw: {
        resource: {
          resourceType: 'DiagnosticReport',
          result: [{ reference }],
        },
      } as never,
      format: 'FHIR.DSTU2',
      content_type: 'application/json',
      resource_type: 'diagnosticreport',
      version_history: [],
    },
    metadata: {
      id: 'report-1',
      date: '2024-02-01T10:00:00-05:00',
      display_name: 'URINALYSIS PANEL',
    },
  });
}

function observation(metadataId: string, connection = 'conn-a') {
  return createTestClinicalDocument({
    id: `${connection}|user-1|${metadataId}`,
    connection_record_id: connection,
    user_id: 'user-1',
    data_record: {
      raw: {
        resource: {
          resourceType: 'Observation',
          code: { text: 'Protein, UA' },
          valueString: 'NEGATIVE',
        },
      } as never,
      format: 'FHIR.DSTU2',
      content_type: 'application/json',
      resource_type: 'observation',
      version_history: [],
    },
    metadata: {
      id: metadataId,
      date: '2024-02-01T10:00:00-05:00',
      display_name: 'Protein, UA',
    },
  });
}

describe('getRelatedDocuments', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('finds an observation stored under the relative id its report refers to', async () => {
    await db.clinical_documents.insert(observation('Observation/obs-1'));

    const [docs] = await getRelatedDocuments({
      db,
      user,
      item: report('Observation/obs-1') as never,
      conn: { location: 'https://onpatient.com' } as ConnectionDocument,
    });

    expect(docs.map((doc) => doc.get('metadata.id'))).toEqual([
      'Observation/obs-1',
    ]);
  });

  it('ignores an observation another connection stores under the same relative id', async () => {
    await db.clinical_documents.bulkInsert([
      observation('Observation/obs-1', 'conn-a'),
      observation('Observation/obs-1', 'conn-b'),
    ]);

    const [docs] = await getRelatedDocuments({
      db,
      user,
      item: report('Observation/obs-1') as never,
      conn: { location: 'https://onpatient.com' } as ConnectionDocument,
    });

    expect(docs.map((doc) => doc.get('connection_record_id'))).toEqual([
      'conn-a',
    ]);
  });

  it('finds an observation stored under the absolute id a relative reference resolves to', async () => {
    await db.clinical_documents.insert(
      observation(
        'https://mepic.example.org/fhir/api/FHIR/R4/Observation/obs-1',
      ),
    );

    const [docs] = await getRelatedDocuments({
      db,
      user,
      item: report('Observation/obs-1') as never,
      conn: {
        location: 'https://mepic.example.org/fhir/api/FHIR/R4/',
      } as ConnectionDocument,
    });

    expect(docs.map((doc) => doc.get('metadata.id'))).toEqual([
      'https://mepic.example.org/fhir/api/FHIR/R4/Observation/obs-1',
    ]);
  });
});
