import { renderHook, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { UserProvider } from '../../app/providers/UserProvider';
import { createTestClinicalDocument } from '../../test-utils/clinicalDocumentTestData';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../test-utils/createTestDatabase';
import { TestProviders } from '../../test-utils/TestProviders';
import { useClinicalDoc } from './useClinicalDoc';

describe('useClinicalDoc', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
    await db.user_documents.insert({
      id: 'user-1',
      is_selected_user: true,
      is_default_user: true,
    });
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  function wrapper({ children }: PropsWithChildren) {
    return (
      <TestProviders db={db}>
        <UserProvider>{children}</UserProvider>
      </TestProviders>
    );
  }

  it('returns the stored attachment of the note', async () => {
    const attachment = createTestClinicalDocument({
      id: 'conn-a|user-1|https://fhir.example.org/Binary/1',
      connection_record_id: 'conn-a',
      user_id: 'user-1',
      data_record: {
        raw: 'Patient is doing well.' as never,
        format: 'FHIR.R4',
        content_type: 'text/plain',
        resource_type: 'documentreference_attachment',
        version_history: [],
      },
      metadata: {
        id: 'https://fhir.example.org/Binary/1',
        date: '2022-01-13T12:00:00-05:00',
      },
    });
    await db.clinical_documents.insert(attachment);

    const { result } = renderHook(
      () => useClinicalDoc('conn-a', 'https://fhir.example.org/Binary/1'),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current).toEqual(attachment);
    });
  });
});
