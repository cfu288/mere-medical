import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { createTestClinicalDocument } from '../../../test-utils/clinicalDocumentTestData';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { getRelatedLoincLabs } from './relatedLabs';

const user = { id: 'user-1' } as UserDocument;

function hemoglobin(overrides: {
  id: string;
  connection: string;
  date: string;
  value: number;
}) {
  return createTestClinicalDocument({
    id: `${overrides.connection}|user-1|${overrides.id}`,
    connection_record_id: overrides.connection,
    user_id: 'user-1',
    data_record: {
      raw: {
        resource: {
          resourceType: 'Observation',
          code: { text: 'Hgb' },
          valueQuantity: { value: overrides.value, unit: 'g/dL' },
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
      display_name: 'Hgb',
      loinc_coding: ['718-7'],
    },
  });
}

describe('getRelatedLoincLabs', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('returns one document per identical result, oldest first, and keeps a disagreeing value', async () => {
    await db.clinical_documents.bulkInsert([
      hemoglobin({
        id: 'hgb-2025-epic',
        connection: 'epic',
        date: '2025-11-10T20:39:00Z',
        value: 16.1,
      }),
      hemoglobin({
        id: 'hgb-2025-cerner',
        connection: 'cerner',
        date: '2025-11-10T20:39:00Z',
        value: 16.1,
      }),
      hemoglobin({
        id: 'hgb-2025-quest',
        connection: 'quest',
        date: '2025-11-10T20:39:00Z',
        value: 15.9,
      }),
      hemoglobin({
        id: 'hgb-2023',
        connection: 'epic',
        date: '2023-03-14T16:48:00Z',
        value: 16,
      }),
    ]);

    const related = await getRelatedLoincLabs({ loinc: ['718-7'], db, user });

    expect(
      related.map((doc) => [
        doc.get('metadata.date'),
        doc.get('data_record.raw.resource.valueQuantity.value'),
      ]),
    ).toEqual([
      ['2023-03-14T16:48:00Z', 16],
      ['2025-11-10T20:39:00Z', 16.1],
      ['2025-11-10T20:39:00Z', 15.9],
    ]);
  });

  it('returns nothing without a loinc code', async () => {
    expect(await getRelatedLoincLabs({ loinc: [], db, user })).toEqual([]);
  });
});
