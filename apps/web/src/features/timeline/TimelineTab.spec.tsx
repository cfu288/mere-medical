import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { createTestClinicalDocument } from '../../test-utils/clinicalDocumentTestData';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../test-utils/createTestDatabase';
import { fetchRecords } from './TimelineTab';

describe('fetchRecords', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('matches a search containing regex punctuation literally', async () => {
    await db.clinical_documents.insert(
      createTestClinicalDocument({
        id: 'conn-a|user-1|obs-1',
        connection_record_id: 'conn-a',
        user_id: 'user-1',
        data_record: {
          raw: { resource: { resourceType: 'Observation' } } as never,
          format: 'FHIR.DSTU2',
          content_type: 'application/json',
          resource_type: 'observation',
          version_history: [],
        },
        metadata: {
          id: 'obs-1',
          date: '2022-01-13T13:41:00-05:00',
          display_name: 'LDL CHOLESTEROL (CALC)',
        },
      }),
    );

    const records = await fetchRecords(db, 'user-1', '(calc)');

    expect(
      Object.values(records)
        .flat()
        .map((r) => r.metadata?.display_name),
    ).toEqual(['LDL CHOLESTEROL (CALC)']);
  });
});
