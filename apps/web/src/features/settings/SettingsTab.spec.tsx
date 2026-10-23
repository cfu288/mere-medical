import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { createTestClinicalDocument } from '../../test-utils/clinicalDocumentTestData';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../test-utils/createTestDatabase';
import { fetchPatientRecords } from './SettingsTab';

describe('fetchPatientRecords', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('returns the patient records of the user', async () => {
    const patient = createTestClinicalDocument({
      id: 'conn-a|user-1|patient-1',
      connection_record_id: 'conn-a',
      user_id: 'user-1',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Patient',
            name: [{ given: ['Ada'], family: 'Lovelace' }],
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'patient',
        version_history: [],
      },
      metadata: { id: 'patient-1', date: '', display_name: 'Ada Lovelace' },
    });
    await db.clinical_documents.bulkInsert([
      patient,
      createTestClinicalDocument({
        id: 'conn-a|user-1|obs-1',
        connection_record_id: 'conn-a',
        user_id: 'user-1',
        metadata: { id: 'obs-1', date: '2022-01-13T12:00:00-05:00' },
      }),
      createTestClinicalDocument({
        id: 'conn-b|user-2|patient-2',
        connection_record_id: 'conn-b',
        user_id: 'user-2',
        data_record: { ...patient.data_record },
        metadata: { id: 'patient-2', date: '', display_name: 'Other' },
      }),
    ]);

    const result = await fetchPatientRecords(db, 'user-1');

    expect(result).toEqual([patient]);
  });
});
