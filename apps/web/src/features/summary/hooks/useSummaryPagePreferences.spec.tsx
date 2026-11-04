import { renderHook, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { TestProviders } from '../../../test-utils/TestProviders';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { useSummaryPagePreferences } from './useSummaryPagePreferences';

describe('useSummaryPagePreferences', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
    await db.summary_page_preferences.bulkInsert([
      { id: 'prefs-a', user_id: 'user-a', pinned_labs: ['lab-1'] },
      { id: 'prefs-b', user_id: 'user-b', pinned_labs: ['lab-2'] },
    ]);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  function wrapper({ children }: PropsWithChildren) {
    return <TestProviders db={db}>{children}</TestProviders>;
  }

  it('returns the preferences of the given user', async () => {
    const { result } = renderHook(() => useSummaryPagePreferences('user-a'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current).toEqual({
        id: 'prefs-a',
        user_id: 'user-a',
        pinned_labs: ['lab-1'],
      });
    });
  });

  it('returns the preferences of the new user when the user changes', async () => {
    const { result, rerender } = renderHook(
      ({ userId }) => useSummaryPagePreferences(userId),
      { wrapper, initialProps: { userId: 'user-a' } },
    );
    await waitFor(() => {
      expect(result.current).toEqual({
        id: 'prefs-a',
        user_id: 'user-a',
        pinned_labs: ['lab-1'],
      });
    });

    rerender({ userId: 'user-b' });

    await waitFor(() => {
      expect(result.current).toEqual({
        id: 'prefs-b',
        user_id: 'user-b',
        pinned_labs: ['lab-2'],
      });
    });
  });
});
