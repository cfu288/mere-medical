import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { UserProvider } from '../../app/providers/UserProvider';
import { findTimelineDocuments } from '../../repositories/ClinicalDocumentRepository';
import {
  createDocumentsForDays,
  createTestClinicalDocument,
} from '../../test-utils/clinicalDocumentTestData';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../test-utils/createTestDatabase';
import { HiddenIntersectionObserver } from '../../test-utils/intersectionObserver';
import { mockColorScheme } from '../../test-utils/matchMedia';
import { TestProviders } from '../../test-utils/TestProviders';
import { fetchRecords, TimelineTab } from './TimelineTab';

jest.mock('../../repositories/ClinicalDocumentRepository', () => {
  const actual = jest.requireActual(
    '../../repositories/ClinicalDocumentRepository',
  );
  return {
    ...actual,
    findTimelineDocuments: jest.fn(actual.findTimelineDocuments),
  };
});

describe('fetchRecords', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('groups the user records by day, newest day first', async () => {
    const glucose = createTestClinicalDocument({
      id: 'conn-a|user-1|obs-1',
      connection_record_id: 'conn-a',
      user_id: 'user-1',
      metadata: {
        id: 'obs-1',
        date: '2022-01-13T12:00:00-05:00',
        display_name: 'GLUCOSE',
      },
    });
    const sodium = createTestClinicalDocument({
      id: 'conn-a|user-1|obs-2',
      connection_record_id: 'conn-a',
      user_id: 'user-1',
      metadata: {
        id: 'obs-2',
        date: '2022-01-14T12:00:00-05:00',
        display_name: 'SODIUM',
      },
    });
    await db.clinical_documents.bulkInsert([glucose, sodium]);

    const records = await fetchRecords(db, 'user-1');

    expect(Object.entries(records)).toEqual([
      ['2022-01-14', [sodium]],
      ['2022-01-13', [glucose]],
    ]);
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

  it('applies the filters together with the search text', async () => {
    const doc = (id: string, type: 'observation' | 'condition', date: string) =>
      createTestClinicalDocument({
        id: `conn-a|user-1|${id}`,
        connection_record_id: 'conn-a',
        user_id: 'user-1',
        data_record: {
          raw: { resource: { resourceType: 'Basic' } } as never,
          format: 'FHIR.R4',
          content_type: 'application/json',
          resource_type: type,
          version_history: [],
        },
        metadata: { id, date, display_name: `GLUCOSE ${id}` },
      });
    const match = doc('obs-1', 'observation', '2024-02-10T12:00:00Z');
    await db.clinical_documents.bulkInsert([
      match,
      doc('obs-2', 'observation', '2023-02-10T12:00:00Z'),
      doc('cond-1', 'condition', '2024-02-10T12:00:00Z'),
    ]);

    const records = await fetchRecords(db, 'user-1', 'glucose', 0, {
      categories: ['labs'],
      from: '2024-01-01',
    });

    expect(Object.values(records).flat()).toEqual([match]);
  });
});

describe('TimelineTab', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    window.IntersectionObserver = HiddenIntersectionObserver;
    mockColorScheme(false);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    db = await createTestDatabase();
    await db.user_documents.insert({
      id: 'user-1',
      is_selected_user: true,
      is_default_user: true,
    });
    // five days of records ending on Jan 15, and the first page shows three
    await db.clinical_documents.bulkInsert(
      createDocumentsForDays('user-1', 5, 2),
    );
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('shows an error with retry when the first load fails', async () => {
    jest
      .mocked(findTimelineDocuments)
      .mockRejectedValueOnce(new Error('database closed'));
    render(
      <MemoryRouter>
        <TestProviders db={db}>
          <UserProvider>
            <TimelineTab />
          </UserProvider>
        </TestProviders>
      </MemoryRouter>,
    );

    await screen.findByText('Unable to load your records');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByText('Jan 15');
    expect(screen.queryByText('Unable to load your records')).toBeNull();
  });

  it('replaces the results with an error when a search fails, and keeps the search box', async () => {
    render(
      <MemoryRouter>
        <TestProviders db={db}>
          <UserProvider>
            <TimelineTab />
          </UserProvider>
        </TestProviders>
      </MemoryRouter>,
    );
    await screen.findByText('Jan 15');
    // the loading skeleton also has a search box, so wait for it to go away
    const input = await screen.findByPlaceholderText(
      'Search your medical records',
    );

    jest
      .mocked(findTimelineDocuments)
      .mockRejectedValueOnce(new Error('database closed'));
    fireEvent.change(input, { target: { value: 'Day 4' } });

    await screen.findByText('Unable to load your records');
    expect(screen.queryByText('Jan 15')).toBeNull();
    expect(screen.queryByText(/load more/i)).toBeNull();
    expect(screen.queryByText('No matching records')).toBeNull();
    expect(screen.getByPlaceholderText('Search your medical records')).toBe(
      input,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByText('Jan 11');
    expect(screen.queryByText('Jan 15')).toBeNull();
  });

  it('keeps the list and says so on the button when load more fails', async () => {
    render(
      <MemoryRouter>
        <TestProviders db={db}>
          <UserProvider>
            <TimelineTab />
          </UserProvider>
        </TestProviders>
      </MemoryRouter>,
    );
    await screen.findByText('Jan 15');

    jest
      .mocked(findTimelineDocuments)
      .mockRejectedValueOnce(new Error('database closed'));
    fireEvent.click(screen.getByRole('button', { name: 'Load more records' }));

    const tryAgain = await screen.findByRole('button', {
      name: 'Unable to load more records. Try again',
    });
    screen.getByText('Jan 15');
    expect(screen.queryByText('Jan 11')).toBeNull();

    fireEvent.click(tryAgain);

    await screen.findByText('Jan 11');
    screen.getByText('Jan 15');
    await waitFor(() => expect(screen.queryByText(/load more/i)).toBeNull());
  });

  it('keeps the search box focused when a search with no results is cleared', async () => {
    render(
      <MemoryRouter>
        <TestProviders db={db}>
          <UserProvider>
            <TimelineTab />
          </UserProvider>
        </TestProviders>
      </MemoryRouter>,
    );
    await screen.findByText('Jan 15');
    // the loading skeleton also has a search box, so wait for it to go away
    const input = await screen.findByPlaceholderText(
      'Search your medical records',
    );
    input.focus();

    fireEvent.change(input, { target: { value: 'no such record' } });
    await screen.findByText('No matching records');

    fireEvent.change(input, { target: { value: '' } });

    expect(screen.queryByText('Link your medical records')).toBeNull();
    expect(screen.getByPlaceholderText('Search your medical records')).toBe(
      input,
    );
    expect(document.activeElement).toBe(input);
    await screen.findByText('Jan 15');
  });
});
