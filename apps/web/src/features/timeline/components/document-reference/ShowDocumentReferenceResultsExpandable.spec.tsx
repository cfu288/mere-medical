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
import { HiddenIntersectionObserver } from '../../../../test-utils/intersectionObserver';

describe('ShowDocumentResultsExpandable', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    window.IntersectionObserver = HiddenIntersectionObserver;
    db = await createTestDatabase();
    await db.user_documents.insert({
      id: 'user-1',
      is_selected_user: true,
      is_default_user: true,
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanupTestDatabase(db);
  });

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
    }) as unknown as ClinicalDocument<BundleEntry<DocumentReference>>,
    attachment = createTestClinicalDocument({
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

  it('shows the stored text of a plain text note', async () => {
    await db.clinical_documents.bulkInsert([note as never, attachment]);

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

  it('shows loading until the lookup resolves', async () => {
    await db.clinical_documents.bulkInsert([note as never, attachment]);
    const findOne = db.clinical_documents.findOne.bind(db.clinical_documents);
    let release!: () => void;
    const released = new Promise<void>((done) => {
      release = done;
    });
    jest.spyOn(db.clinical_documents, 'findOne').mockImplementation(
      (query) =>
        ({
          exec: () => released.then(() => findOne(query).exec()),
        }) as never,
    );

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

    expect(await screen.findByText('Loading...')).toBeTruthy();
    expect(
      screen.queryByText(
        'Sorry, looks like we were unable to get the linked document',
      ),
    ).toBeNull();

    release();

    expect(await screen.findByText('Patient is doing well.')).toBeTruthy();
    expect(
      screen.queryByText(
        'Sorry, looks like we were unable to get the linked document',
      ),
    ).toBeNull();
  });

  it('reports a linked document that is not stored', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await db.clinical_documents.insert(note as never);

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

    expect(
      await screen.findByText(
        'Sorry, looks like we were unable to get the linked document',
      ),
    ).toBeTruthy();
  });

  it('reports a linked document when the lookup fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(db.clinical_documents, 'findOne').mockReturnValue({
      exec: () => Promise.reject(new Error('lookup failed')),
    } as never);

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

    expect(
      await screen.findByText(
        'Sorry, looks like we were unable to get the linked document',
      ),
    ).toBeTruthy();
  });

  it('reports a note that links no document', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const findOne = jest.spyOn(db.clinical_documents, 'findOne');

    const noteWithoutLink = {
      ...note,
      data_record: {
        ...note.data_record,
        raw: { resource: { resourceType: 'DocumentReference' } } as never,
      },
      metadata: {},
    };
    render(
      <TestProviders db={db}>
        <UserProvider>
          <ShowDocumentResultsExpandable
            item={noteWithoutLink}
            expanded={true}
            setExpanded={() => undefined}
          />
        </UserProvider>
      </TestProviders>,
    );

    expect(
      await screen.findByText(
        'Sorry, looks like we were unable to get the linked document',
      ),
    ).toBeTruthy();
    expect(findOne).not.toHaveBeenCalled();
  });
});
