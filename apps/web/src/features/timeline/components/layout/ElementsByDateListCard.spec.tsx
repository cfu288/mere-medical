import { render, screen } from '@testing-library/react';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../../app/providers/DatabaseCollections';
import { UserProvider } from '../../../../app/providers/UserProvider';
import { createTestClinicalDocument } from '../../../../test-utils/clinicalDocumentTestData';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../../test-utils/createTestDatabase';
import { TestProviders } from '../../../../test-utils/TestProviders';
import { ElementsByDateListCard } from './ElementsByDateListCard';

class VisibleIntersectionObserver {
  constructor(
    private callback: (entries: { isIntersecting: boolean }[]) => void,
  ) {}
  observe() {
    this.callback([{ isIntersecting: true }]);
  }
  disconnect() {
    return undefined;
  }
}

describe('ElementsByDateListCard', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    window.IntersectionObserver =
      VisibleIntersectionObserver as unknown as typeof IntersectionObserver;
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

  it('previews the history of present illness of a C-CDA note', async () => {
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
    });
    await db.clinical_documents.bulkInsert([
      note,
      createTestClinicalDocument({
        id: 'conn-a|user-1|https://fhir.example.org/Binary/1',
        connection_record_id: 'conn-a',
        user_id: 'user-1',
        data_record: {
          raw: '<ClinicalDocument xmlns="urn:hl7-org:v3"><component><structuredBody><component><section><templateId root="1.3.6.1.4.1.19376.1.5.3.1.3.4"/><text>Feeling better since the last visit.</text></section></component></structuredBody></component></ClinicalDocument>' as never,
          format: 'FHIR.R4',
          content_type: 'application/xml',
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
          <ElementsByDateListCard itemList={[note]} />
        </UserProvider>
      </TestProviders>,
    );

    const text = await screen.findByText(
      'Feeling better since the last visit.',
    );

    expect(text.textContent).toBe('Feeling better since the last visit.');
  });
});
