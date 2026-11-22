import { act, renderHook, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { TestProviders } from '../../../test-utils/TestProviders';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { createDocumentsForDays } from '../../../test-utils/clinicalDocumentTestData';
import { findTimelineDocuments } from '../../../repositories/ClinicalDocumentRepository';
import { QueryStatus } from '../types';
import { useRecordQuery } from './useRecordQuery';

jest.mock('../../../app/providers/UserProvider', () => ({
  useUser: () => ({ id: 'user-a' }),
}));

jest.mock('../../../repositories/ClinicalDocumentRepository', () => {
  const actual = jest.requireActual(
    '../../../repositories/ClinicalDocumentRepository',
  );
  return {
    ...actual,
    findTimelineDocuments: jest.fn(actual.findTimelineDocuments),
  };
});

const countRecords = (data: Record<string, unknown[]> | undefined) =>
  Object.values(data ?? {}).reduce((sum, list) => sum + list.length, 0);

describe('useRecordQuery', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    db = await createTestDatabase();
    await db.clinical_documents.bulkInsert(
      createDocumentsForDays('user-a', 5, 2),
    );
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  function wrapper({ children }: PropsWithChildren) {
    return <TestProviders db={db}>{children}</TestProviders>;
  }

  it('loads complete days, then appends the rest without duplicates', async () => {
    const { result } = renderHook(() => useRecordQuery(''), { wrapper });
    await waitFor(() =>
      expect(result.current.status).toBe(QueryStatus.SUCCESS),
    );
    expect(Object.keys(result.current.data ?? {})).toHaveLength(3);

    act(() => result.current.loadNextPage());
    await waitFor(() =>
      expect(result.current.status).toBe(QueryStatus.COMPLETE_HIDE_LOAD_MORE),
    );
    expect(Object.keys(result.current.data ?? {})).toHaveLength(5);
    expect(countRecords(result.current.data)).toBe(10);
  });

  it('reports a failed first load and recovers on retry', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest
      .mocked(findTimelineDocuments)
      .mockRejectedValueOnce(new Error('database closed'));

    const { result } = renderHook(() => useRecordQuery(''), { wrapper });
    await waitFor(() => expect(result.current.status).toBe(QueryStatus.ERROR));
    expect(result.current.data).toBeUndefined();
    expect(result.current.initialized).toBe(false);

    act(() => result.current.retry());
    await waitFor(() =>
      expect(result.current.status).toBe(QueryStatus.SUCCESS),
    );
    expect(result.current.initialized).toBe(true);
  });

  it('keeps the loaded days when load more fails, and can try again', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useRecordQuery(''), { wrapper });
    await waitFor(() =>
      expect(result.current.status).toBe(QueryStatus.SUCCESS),
    );

    jest
      .mocked(findTimelineDocuments)
      .mockRejectedValueOnce(new Error('database closed'));
    act(() => result.current.loadNextPage());
    await waitFor(() =>
      expect(result.current.status).toBe(QueryStatus.LOAD_MORE_ERROR),
    );
    expect(countRecords(result.current.data)).toBe(6);

    act(() => result.current.loadNextPage());
    await waitFor(() =>
      expect(result.current.status).toBe(QueryStatus.COMPLETE_HIDE_LOAD_MORE),
    );
    expect(countRecords(result.current.data)).toBe(10);
  });

  it('pages through search results and reloads when the query changes', async () => {
    await db.clinical_documents.bulkInsert(
      createDocumentsForDays('user-a', 6, 10).map((doc, i) => ({
        ...doc,
        metadata: { ...doc.metadata, display_name: `Needle ${i}` },
      })),
    );
    const { result, rerender } = renderHook(
      ({ query }) => useRecordQuery(query),
      { wrapper, initialProps: { query: 'Needle' } },
    );

    await waitFor(() =>
      expect(result.current.status).toBe(QueryStatus.SUCCESS),
    );
    expect(countRecords(result.current.data)).toBe(50);

    act(() => result.current.loadNextPage());
    await waitFor(() =>
      expect(result.current.status).toBe(QueryStatus.COMPLETE_HIDE_LOAD_MORE),
    );
    expect(countRecords(result.current.data)).toBe(60);

    rerender({ query: 'Needle 59' });
    expect(result.current.status).toBe(QueryStatus.LOADING);
    await waitFor(() => expect(countRecords(result.current.data)).toBe(1));
    expect(result.current.status).toBe(QueryStatus.COMPLETE_HIDE_LOAD_MORE);
  });
});
