import { createTestClinicalDocument } from '../../../test-utils/clinicalDocumentTestData';
import { NO_FILTERS } from '../timelineFilters';
import { QueryStatus } from '../types';
import { queryReducer, QueryKey, QueryState } from './useRecordQuery';

const a = createTestClinicalDocument({ id: 'a' });
const b = createTestClinicalDocument({ id: 'b' });
const c = createTestClinicalDocument({ id: 'c' });

const key: QueryKey = { query: '', filters: NO_FILTERS, userId: 'user-a' };

// one page is loaded and more records exist
const loaded: QueryState = {
  requestId: 1,
  key,
  initialized: true,
  status: QueryStatus.SUCCESS,
  data: { '2024-01-02': [a] },
  cursor: 1,
};

describe('queryReducer', () => {
  describe('first page', () => {
    const loading: QueryState = {
      requestId: 1,
      key,
      initialized: false,
      status: QueryStatus.LOADING,
      data: undefined,
    };

    it('shows the page and offers load more when more records exist', () => {
      const state = queryReducer(loading, {
        type: 'PAGE_LOADED',
        requestId: 1,
        records: { '2024-01-02': [a] },
        cursor: 1,
        hasMore: true,
      });

      expect(state).toEqual(loaded);
    });

    it('hides load more when no records remain', () => {
      const state = queryReducer(loading, {
        type: 'PAGE_LOADED',
        requestId: 1,
        records: {},
        cursor: 0,
        hasMore: false,
      });

      expect(state.status).toBe(QueryStatus.COMPLETE_HIDE_LOAD_MORE);
    });

    it('shows partial results while the page still loads', () => {
      const state = queryReducer(loading, {
        type: 'PARTIAL_RESULTS',
        requestId: 1,
        records: { '2024-01-02': [a] },
      });

      expect(state).toEqual({
        requestId: 1,
        key,
        initialized: true,
        status: QueryStatus.LOADING,
        data: { '2024-01-02': [a] },
      });
    });

    it('has no records after the load fails', () => {
      const state = queryReducer(loading, {
        type: 'QUERY_FAILED',
        requestId: 1,
      });

      expect(state).toEqual({
        requestId: 1,
        key,
        initialized: false,
        status: QueryStatus.ERROR,
      });
    });

    it('does not start load more', () => {
      const state = queryReducer(loading, {
        type: 'LOAD_MORE_STARTED',
        requestId: 2,
        cursor: 0,
      });

      expect(state).toBe(loading);
    });
  });

  describe('new query', () => {
    it('keeps the previous results on screen while it loads', () => {
      const state = queryReducer(loaded, {
        type: 'LOAD_STARTED',
        requestId: 2,
        key: { ...key, query: 'glucose' },
      });

      expect(state).toEqual({
        requestId: 2,
        key: { ...key, query: 'glucose' },
        initialized: true,
        status: QueryStatus.LOADING,
        data: { '2024-01-02': [a] },
      });
    });

    it('drops the previous results when the user changed', () => {
      const state = queryReducer(loaded, {
        type: 'LOAD_STARTED',
        requestId: 2,
        key: { ...key, userId: 'user-b' },
      });

      expect(state).toMatchObject({
        status: QueryStatus.LOADING,
        data: undefined,
      });
    });

    it('ignores a response to the request it replaced', () => {
      const loading = queryReducer(loaded, {
        type: 'LOAD_STARTED',
        requestId: 2,
        key,
      });

      const state = queryReducer(loading, {
        type: 'PAGE_LOADED',
        requestId: 1,
        records: { '2023-01-01': [b] },
        cursor: 9,
        hasMore: false,
      });

      expect(state).toBe(loading);
    });

    it('starts again from a failed query', () => {
      const failed: QueryState = {
        requestId: 1,
        key,
        initialized: false,
        status: QueryStatus.ERROR,
      };

      const state = queryReducer(failed, {
        type: 'LOAD_STARTED',
        requestId: 2,
        key,
      });

      expect(state).toEqual({
        requestId: 2,
        key,
        initialized: false,
        status: QueryStatus.LOADING,
        data: undefined,
      });
    });
  });

  describe('load more', () => {
    const loadingMore: QueryState = {
      requestId: 2,
      key,
      initialized: true,
      status: QueryStatus.LOADING_MORE,
      data: { '2024-01-02': [a] },
      cursor: 1,
      partial: undefined,
    };

    it('starts from a loaded page', () => {
      const state = queryReducer(loaded, {
        type: 'LOAD_MORE_STARTED',
        requestId: 2,
        cursor: 1,
      });

      expect(state).toEqual(loadingMore);
    });

    it('does not start with the cursor of another query', () => {
      const state = queryReducer(loaded, {
        type: 'LOAD_MORE_STARTED',
        requestId: 2,
        cursor: 7,
      });

      expect(state).toBe(loaded);
    });

    it('does not start again while it runs', () => {
      const state = queryReducer(loadingMore, {
        type: 'LOAD_MORE_STARTED',
        requestId: 3,
        cursor: 1,
      });

      expect(state).toBe(loadingMore);
    });

    it('does not start when no records remain', () => {
      const complete: QueryState = {
        ...loaded,
        status: QueryStatus.COMPLETE_HIDE_LOAD_MORE,
      };

      const state = queryReducer(complete, {
        type: 'LOAD_MORE_STARTED',
        requestId: 2,
        cursor: 1,
      });

      expect(state).toBe(complete);
    });

    it('holds partial results apart from the loaded pages', () => {
      const state = queryReducer(loadingMore, {
        type: 'PARTIAL_RESULTS',
        requestId: 2,
        records: { '2024-01-01': [b] },
      });

      expect(state).toEqual({
        ...loadingMore,
        partial: { '2024-01-01': [b] },
      });
    });

    it('appends the page once when partial results came first', () => {
      const withPartial: QueryState = {
        ...loadingMore,
        partial: { '2024-01-01': [b] },
      };

      const state = queryReducer(withPartial, {
        type: 'PAGE_LOADED',
        requestId: 2,
        records: { '2024-01-01': [b, c] },
        cursor: 3,
        hasMore: true,
      });

      expect(state).toEqual({
        requestId: 2,
        key,
        initialized: true,
        status: QueryStatus.SUCCESS,
        data: { '2024-01-02': [a], '2024-01-01': [b, c] },
        cursor: 3,
      });
    });

    it('appends to a day that the loaded pages already have', () => {
      const state = queryReducer(loadingMore, {
        type: 'PAGE_LOADED',
        requestId: 2,
        records: { '2024-01-02': [b] },
        cursor: 2,
        hasMore: false,
      });

      expect(state).toMatchObject({ data: { '2024-01-02': [a, b] } });
    });

    it('keeps the loaded pages and the cursor when it fails', () => {
      const withPartial: QueryState = {
        ...loadingMore,
        partial: { '2024-01-01': [b] },
      };

      const state = queryReducer(withPartial, {
        type: 'QUERY_FAILED',
        requestId: 2,
      });

      expect(state).toEqual({
        requestId: 2,
        key,
        initialized: true,
        status: QueryStatus.LOAD_MORE_ERROR,
        data: { '2024-01-02': [a] },
        cursor: 1,
      });
    });

    it('starts again after it failed', () => {
      const failed: QueryState = {
        ...loaded,
        status: QueryStatus.LOAD_MORE_ERROR,
      };

      const state = queryReducer(failed, {
        type: 'LOAD_MORE_STARTED',
        requestId: 2,
        cursor: 1,
      });

      expect(state.status).toBe(QueryStatus.LOADING_MORE);
    });

    it('drops the partial results when the query changes', () => {
      const withPartial: QueryState = {
        ...loadingMore,
        partial: { '2024-01-01': [b] },
      };

      const state = queryReducer(withPartial, {
        type: 'LOAD_STARTED',
        requestId: 3,
        key,
      });

      expect(state).toEqual({
        requestId: 3,
        key,
        initialized: true,
        status: QueryStatus.LOADING,
        data: { '2024-01-02': [a] },
      });
    });
  });
});
