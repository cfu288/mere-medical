import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useDebounceCallback } from '@react-hook/debounce';
import { RxDatabase } from 'rxdb';
import { VectorStorage } from '@mere/vector-storage';
import { useLocalConfig } from '../../../app/providers/LocalConfigProvider';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { useUser } from '../../../app/providers/UserProvider';
import { useVectors } from '../../vectors';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { QueryStatus, RecordsByDate } from '../types';
import {
  fetchRecords,
  fetchRecordsWithVectorSearch,
  fetchRecordsUntilCompleteDays,
  mergeRecordsByDate,
  PAGE_SIZE,
} from '../TimelineTab';

interface QueryState {
  status: QueryStatus;
  initialized: boolean;
  data: RecordsByDate | undefined;
  groupedOffset: number;
  searchPage: number;
}

type QueryAction =
  | { type: 'START_INITIAL_LOAD' }
  | { type: 'START_LOAD_MORE' }
  | { type: 'RECEIVE_PARTIAL_RESULTS'; records: RecordsByDate; merge: boolean }
  | {
      type: 'GROUPED_QUERY_SUCCESS';
      records: RecordsByDate;
      lastOffset: number;
      hasMore: boolean;
      merge: boolean;
    }
  | {
      type: 'SEARCH_QUERY_SUCCESS';
      records: RecordsByDate;
      page: number;
      hasMore: boolean;
      merge: boolean;
    }
  | { type: 'VECTOR_SEARCH_SUCCESS'; records: RecordsByDate }
  | { type: 'QUERY_ERROR' }
  | { type: 'RESET_PAGINATION' };

function queryReducer(state: QueryState, action: QueryAction): QueryState {
  switch (action.type) {
    case 'START_INITIAL_LOAD':
      return { ...state, status: QueryStatus.LOADING };

    case 'START_LOAD_MORE':
      return { ...state, status: QueryStatus.LOADING_MORE };

    case 'RECEIVE_PARTIAL_RESULTS':
      return {
        ...state,
        initialized: true,
        data: action.merge
          ? mergeRecordsByDate(state.data, action.records)
          : action.records,
      };

    case 'GROUPED_QUERY_SUCCESS':
      return {
        ...state,
        initialized: true,
        data: action.merge
          ? mergeRecordsByDate(state.data, action.records)
          : action.records,
        groupedOffset: action.lastOffset,
        status: action.hasMore
          ? QueryStatus.SUCCESS
          : QueryStatus.COMPLETE_HIDE_LOAD_MORE,
      };

    case 'SEARCH_QUERY_SUCCESS':
      return {
        ...state,
        initialized: true,
        data: action.merge
          ? mergeRecordsByDate(state.data, action.records)
          : action.records,
        searchPage: action.page,
        status: action.hasMore
          ? QueryStatus.SUCCESS
          : QueryStatus.COMPLETE_HIDE_LOAD_MORE,
      };

    case 'VECTOR_SEARCH_SUCCESS':
      return {
        ...state,
        initialized: true,
        data: action.records,
        status: QueryStatus.COMPLETE_HIDE_LOAD_MORE,
      };

    case 'QUERY_ERROR':
      return { ...state, status: QueryStatus.ERROR };

    case 'RESET_PAGINATION':
      return {
        ...state,
        status: QueryStatus.LOADING,
        groupedOffset: 0,
        searchPage: 0,
      };

    default:
      return state;
  }
}

const initialState: QueryState = {
  status: QueryStatus.IDLE,
  initialized: false,
  data: undefined,
  groupedOffset: 0,
  searchPage: 0,
};

async function executeGroupedQuery(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  minCompleteDays: number,
  offset: number,
  loadMore: boolean,
  dispatch: React.Dispatch<QueryAction>,
) {
  console.debug('useRecordQuery: grouped view', { offset, loadMore });

  const result = await fetchRecordsUntilCompleteDays(
    db,
    userId,
    minCompleteDays,
    offset,
    3000,
    (partial) => {
      console.debug('useRecordQuery: received partial results', {
        days: Object.keys(partial.records).length,
        lastOffset: partial.lastOffset,
      });
      dispatch({
        type: 'RECEIVE_PARTIAL_RESULTS',
        records: partial.records,
        merge: loadMore,
      });
    },
  );

  console.debug('useRecordQuery: grouped result', {
    days: Object.keys(result.records).length,
    hasMore: result.hasMore,
    lastOffset: result.lastOffset,
  });

  dispatch({
    type: 'GROUPED_QUERY_SUCCESS',
    records: result.records,
    lastOffset: result.lastOffset,
    hasMore: result.hasMore,
    merge: loadMore,
  });
}

async function executeSearchQuery(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  query: string,
  page: number,
  loadMore: boolean,
  vectorSearchConfig: {
    vectorStorage: VectorStorage<DatabaseCollections> | undefined;
    enableVectorSearch: boolean | undefined;
    enableAISemanticSearch: boolean;
  },
  dispatch: React.Dispatch<QueryAction>,
): Promise<boolean> {
  console.debug('useRecordQuery: search query', { query, page, loadMore });

  let records = await fetchRecords(db, userId, query, page);
  const hasNoResults = Object.keys(records).length === 0;

  if (hasNoResults && shouldFallbackToVectorSearch(vectorSearchConfig)) {
    dispatch({ type: 'START_INITIAL_LOAD' });

    records = (
      await fetchRecordsWithVectorSearch({
        db,
        vectorStorage:
          vectorSearchConfig.vectorStorage as VectorStorage<DatabaseCollections>,
        query,
        userId,
        numResults: 20,
        enableSearchAttachments: true,
        groupByDate: true,
      })
    ).records;

    dispatch({ type: 'VECTOR_SEARCH_SUCCESS', records });
    return true;
  }

  const recordCount = Object.values(records).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  const hasMore = recordCount >= PAGE_SIZE;

  console.debug('useRecordQuery: search result', {
    recordCount,
    hasMore,
    page,
  });

  dispatch({
    type: 'SEARCH_QUERY_SUCCESS',
    records,
    page,
    hasMore,
    merge: loadMore,
  });

  return false;
}

function shouldFallbackToVectorSearch(config: {
  vectorStorage: VectorStorage<DatabaseCollections> | undefined;
  enableVectorSearch: boolean | undefined;
  enableAISemanticSearch: boolean;
}): boolean {
  return !!(
    config.vectorStorage &&
    config.enableVectorSearch &&
    config.enableAISemanticSearch
  );
}

/**
 * Manages record fetching for the timeline view with two distinct modes:
 *
 * **Grouped View** (no query): Fetches records grouped by date with incremental loading.
 * Uses a 3-second timeout with the following behavior:
 * - Normal: Fetches until `minCompleteDays` complete days are loaded
 * - Timeout with 1+ complete days: Returns only complete days immediately
 * - Timeout with 0 complete days: Emits partial results while continuing to fetch
 *
 * A day is "complete" when we've confirmed no more records exist for that date
 * (by seeing a record from a different date in the sorted results).
 *
 * **Search View** (with query): Fetches records matching the query with pagination.
 * Falls back to vector search if text search returns no results and AI search is enabled.
 *
 * @param query - Search query string. Empty string triggers grouped view mode.
 * @param enableAISemanticSearch - Whether to fall back to vector search on empty results
 * @param minCompleteDays - Minimum number of complete days to fetch in grouped view (default: 3)
 */
export function useRecordQuery(
  query: string,
  enableAISemanticSearch?: boolean,
  minCompleteDays = 3,
): {
  data: RecordsByDate | undefined;
  status: QueryStatus;
  initialized: boolean;
  loadNextPage: () => void;
  showIndividualItems: boolean;
} {
  const db = useRxDb();
  const { experimental__use_openai_rag } = useLocalConfig();
  const user = useUser();
  const vectorStorage = useVectors();
  const requestIdRef = useRef(0);

  const [state, dispatch] = useReducer(queryReducer, initialState);

  const isGroupedView = !query;
  const showIndividualItems = !isGroupedView;

  const execQuery = useCallback(
    async (loadMore: boolean) => {
      const thisRequestId = ++requestIdRef.current;

      const guardedDispatch: typeof dispatch = (action) => {
        if (requestIdRef.current !== thisRequestId) {
          console.debug('useRecordQuery: ignoring stale response');
          return;
        }
        dispatch(action);
      };

      guardedDispatch(
        loadMore ? { type: 'START_LOAD_MORE' } : { type: 'START_INITIAL_LOAD' },
      );

      try {
        if (isGroupedView) {
          const offset = loadMore ? state.groupedOffset : 0;
          await executeGroupedQuery(
            db,
            user.id,
            minCompleteDays,
            offset,
            loadMore,
            guardedDispatch,
          );
        } else {
          const page = loadMore ? state.searchPage + 1 : 0;
          await executeSearchQuery(
            db,
            user.id,
            query,
            page,
            loadMore,
            {
              vectorStorage,
              enableVectorSearch: experimental__use_openai_rag,
              enableAISemanticSearch: !!enableAISemanticSearch,
            },
            guardedDispatch,
          );
        }
      } catch (e) {
        console.error(e);
        guardedDispatch({ type: 'QUERY_ERROR' });
      }
    },
    [
      db,
      user.id,
      query,
      isGroupedView,
      state.groupedOffset,
      state.searchPage,
      minCompleteDays,
      vectorStorage,
      experimental__use_openai_rag,
      enableAISemanticSearch,
    ],
  );

  const execQueryRef = useRef(execQuery);
  execQueryRef.current = execQuery;

  const loadNextPage = useDebounceCallback(
    () => execQueryRef.current(true),
    300,
  );

  useEffect(() => {
    dispatch({ type: 'RESET_PAGINATION' });
    execQueryRef.current(false);
  }, [query, enableAISemanticSearch]);

  return {
    data: state.data,
    status: state.status,
    initialized: state.initialized,
    loadNextPage,
    showIndividualItems,
  };
}
