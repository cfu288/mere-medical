import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { UserProvider } from '../../../app/providers/UserProvider';
import { createTestClinicalDocument } from '../../../test-utils/clinicalDocumentTestData';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { TestProviders } from '../../../test-utils/TestProviders';
import { UserCard } from './UserCard';

class HiddenIntersectionObserver {
  observe() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

describe('UserCard', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    window.IntersectionObserver =
      HiddenIntersectionObserver as unknown as typeof IntersectionObserver;
    db = await createTestDatabase();
    await db.user_documents.insert({
      id: 'user-1',
      is_selected_user: true,
      is_default_user: true,
    });
    await db.clinical_documents.insert(
      createTestClinicalDocument({
        id: 'conn-a|user-1|patient-1',
        connection_record_id: 'conn-a',
        user_id: 'user-1',
        data_record: {
          raw: {
            resource: {
              resourceType: 'Patient',
              name: [{ given: ['Ada'], family: ['Lovelace'] }],
              telecom: [{ system: 'email', value: 'ada@example.com' }],
              gender: 'female',
            },
          } as never,
          format: 'FHIR.DSTU2',
          content_type: 'application/json',
          resource_type: 'patient',
          version_history: [],
        },
        metadata: { id: 'patient-1', date: '', display_name: 'Ada Lovelace' },
      }),
    );
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('saves the details from the patient record to a new user', async () => {
    render(
      <TestProviders db={db}>
        <UserProvider>
          <UserCard />
        </UserProvider>
      </TestProviders>,
    );
    fireEvent.click(await screen.findByText('Add your information'));
    await screen.findByDisplayValue('Lovelace');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(async () => {
      const user = await db.user_documents.findOne('user-1').exec();
      expect(user?.toJSON()).toEqual({
        id: 'user-1',
        is_selected_user: true,
        is_default_user: false,
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        gender: 'female',
      });
    });
  });
});
