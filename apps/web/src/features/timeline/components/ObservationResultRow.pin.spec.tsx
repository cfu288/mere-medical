import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BundleEntry, Observation } from 'fhir/r2';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { UserProvider } from '../../../app/providers/UserProvider';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { createTestClinicalDocument } from '../../../test-utils/clinicalDocumentTestData';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { TestProviders } from '../../../test-utils/TestProviders';
import { ObservationResultRow } from './ObservationResultRow';

describe('ObservationResultRow pin button', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
    await db.user_documents.insert({
      id: 'user-1',
      is_selected_user: true,
      is_default_user: true,
    });
    await db.summary_page_preferences.insert({
      id: 'prefs-1',
      user_id: 'user-1',
      pinned_labs: ['conn-a|user-1|obs-0'],
    });
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('adds the result to the pinned labs of the user', async () => {
    const glucose = createTestClinicalDocument({
      id: 'conn-a|user-1|obs-1',
      connection_record_id: 'conn-a',
      user_id: 'user-1',
      metadata: {
        id: 'obs-1',
        date: '2022-01-13T12:00:00-05:00',
        display_name: 'GLUCOSE',
      },
    }) as unknown as ClinicalDocument<BundleEntry<Observation>>;

    render(
      <TestProviders db={db}>
        <UserProvider>
          <ObservationResultRow item={glucose} />
        </UserProvider>
      </TestProviders>,
    );
    fireEvent.click((await screen.findByTitle('Pin lab')).closest('button')!);

    await waitFor(async () => {
      const preferences = await db.summary_page_preferences
        .findOne('prefs-1')
        .exec();
      expect(preferences?.toJSON()).toEqual({
        id: 'prefs-1',
        user_id: 'user-1',
        pinned_labs: ['conn-a|user-1|obs-0', 'conn-a|user-1|obs-1'],
      });
    });
  });
});
