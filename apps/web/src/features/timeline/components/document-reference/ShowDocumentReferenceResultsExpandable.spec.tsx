import { render, screen } from '@testing-library/react';
import { BundleEntry, DocumentReference } from 'fhir/r2';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../../app/providers/DatabaseCollections';
import { UserProvider } from '../../../../app/providers/UserProvider';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { createTestClinicalDocument } from '../../../../test-utils/clinicalDocumentTestData';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../../test-utils/createTestDatabase';
import { TestProviders } from '../../../../test-utils/TestProviders';
import { ShowDocumentResultsExpandable } from './ShowDocumentReferenceResultsExpandable';

class HiddenIntersectionObserver {
  observe() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

describe('ShowDocumentResultsExpandable', () => {
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
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('shows the stored text of a plain text note', async () => {
    const note = createTestClinicalDocument({
      id: 'conn-a|user-1|https://fhir.example.org/DocumentReference/1',
      connection_record_id: 'conn-a',
      user_id: 'user-1',
      data_record: {
        raw: {
          resource: {
            resourceType: 'DocumentReference',
            content: [
              { attachment: { url: 'https://fhir.example.org/Binary/1' } },
            ],
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'documentreference',
        version_history: [],
      },
      metadata: {
        id: 'https://fhir.example.org/DocumentReference/1',
        date: '2022-01-13T12:00:00-05:00',
        display_name: 'Progress Note',
      },
    }) as unknown as ClinicalDocument<BundleEntry<DocumentReference>>;
    await db.clinical_documents.bulkInsert([
      note as never,
      createTestClinicalDocument({
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
      }),
    ]);

    render(
      <TestProviders db={db}>
        <UserProvider>
          <ShowDocumentResultsExpandable
            item={note}
            expanded={true}
            setExpanded={() => undefined}
          />
        </UserProvider>
      </TestProviders>,
    );

    const text = await screen.findByText('Patient is doing well.');

    expect(text.textContent).toBe('Patient is doing well.');
  });
});
