import { useCallback, useEffect, useReducer, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { useDebounceCallback } from '@react-hook/debounce';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { MangoQuerySelector, RxDatabase } from 'rxdb';
import { VectorStorage } from '@mere/vector-storage';
import { useLocalConfig } from '../../../app/providers/LocalConfigProvider';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { useUser } from '../../../app/providers/UserProvider';
import { useVectors } from '../../vectors';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { QueryStatus, RecordsByDate } from '../types';
import {
  fetchRecords,
  fetchRecordsWithVectorSearch,
  PAGE_SIZE,
} from '../TimelineTab';

export const GROUPED_VIEW_BATCH_SIZE = 250;

export async function fetchRawRecords(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
  offset: number,
  limit: number,
): Promise<ClinicalDocument<BundleEntry<FhirResource>>[]> {
  const selector: MangoQuerySelector<ClinicalDocument<unknown>> = {
    user_id: user_id,
    'data_record.resource_type': {
      $nin: [
        'patient',
        'careplan',
        'documentreference_attachment',
        'provenance',
      ],
    },
    'metadata.date': { $nin: [null, undefined, ''] },
  };

  const docs = await db.clinical_documents
    .find({
      selector,
      sort: [{ 'metadata.date': 'desc' }],
    })
    .skip(offset)
    .limit(limit)
    .exec();

  return docs.map(
    (doc) => doc.toMutableJSON() as ClinicalDocument<BundleEntry<FhirResource>>,
  );
}

export function getRecordDateKey(
  record: ClinicalDocument<BundleEntry<FhirResource>>,
): string {
  if (!record.metadata?.date) {
    return new Date(0).toISOString().split('T')[0];
  }
  return format(parseISO(record.metadata.date), 'yyyy-MM-dd');
}

export function groupRecordsByDate(
  records: ClinicalDocument<BundleEntry<FhirResource>>[],
): Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]> {
  const grouped: Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]> =
    {};

  for (const record of records) {
    const dateKey = getRecordDateKey(record);
    if (grouped[dateKey]) {
      grouped[dateKey].push(record);
    } else {
      grouped[dateKey] = [record];
    }
  }

  return grouped;
}

export function mergeRecordsByDate(
  existing:
    | Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>
    | undefined,
  incoming: Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>,
): Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]> {
  if (!existing) return incoming;
  const merged = { ...existing };
  for (const [dateKey, records] of Object.entries(incoming)) {
    merged[dateKey] = merged[dateKey]
      ? [...merged[dateKey], ...records]
      : records;
  }
  return merged;
}

export type PartialResultsCallback = (partial: {
  records: Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>;
  hasMore: boolean;
  lastOffset: number;
}) => void;

/**
 * Fetches records grouped by date with incremental loading for the timeline view.
 *
 * Uses a timeout with the following behavior:
 * - Normal: Fetches until `minDays` complete days are loaded
 * - Timeout with 1+ complete days: Returns only complete days immediately
 * - Timeout with 0 complete days: Emits partial results each batch until at least
 *   one day is complete, so the user sees progress rather than a loading screen
 *
 * A day is "complete" when we've confirmed no more records exist for that date
 * (by seeing a record from a different date in the sorted results).
 */
export async function fetchRecordsUntilCompleteDays(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
  minDays: number = 5,
  existingOffset: number = 0,
  timeoutMs: number = 3000,
  onPartialResults?: PartialResultsCallback,
): Promise<{
  records: Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>;
  hasMore: boolean;
  lastOffset: number;
}> {
  const startTime = Date.now();
  let offset = existingOffset;
  const allRecords: ClinicalDocument<BundleEntry<FhirResource>>[] = [];
  const uniqueDates = new Set<string>();
  const completeDates = new Set<string>();
  let newestDate: string | null = null;
  let hasMore = true;
  let iteration = 0;

  while (true) {
    iteration++;
    const batchStartTime = Date.now();
    const batch = await fetchRawRecords(
      db,
      user_id,
      offset,
      GROUPED_VIEW_BATCH_SIZE,
    );
    const batchDuration = Date.now() - batchStartTime;
    const elapsed = Date.now() - startTime;

    console.debug('[fetchRecordsUntilCompleteDays] batch fetched', {
      iteration,
      batchSize: batch.length,
      batchDuration,
      elapsed,
      timeoutMs,
      offset,
      uniqueDates: uniqueDates.size,
      completeDates: completeDates.size,
      totalRecords: allRecords.length,
    });

    if (batch.length === 0) {
      console.debug('[fetchRecordsUntilCompleteDays] exiting: empty batch');
      hasMore = false;
      break;
    }

    for (const record of batch) {
      const dateKey = getRecordDateKey(record);
      if (newestDate && dateKey < newestDate) {
        completeDates.add(newestDate);
      }
      newestDate = dateKey;
      uniqueDates.add(dateKey);
    }

    allRecords.push(...batch);
    offset += batch.length;

    if (batch.length < GROUPED_VIEW_BATCH_SIZE) {
      console.debug('[fetchRecordsUntilCompleteDays] exiting: partial batch', {
        batchSize: batch.length,
        expectedSize: GROUPED_VIEW_BATCH_SIZE,
      });
      hasMore = false;
      break;
    }

    const timeoutExceeded = elapsed > timeoutMs;
    const hasEnoughDays = uniqueDates.size >= minDays;

    console.debug('[fetchRecordsUntilCompleteDays] exit check', {
      iteration,
      hasEnoughDays,
      timeoutExceeded,
      uniqueDates: uniqueDates.size,
      completeDates: completeDates.size,
      minDays,
    });

    if (timeoutExceeded && completeDates.size >= 1) {
      console.debug(
        '[fetchRecordsUntilCompleteDays] timeout with complete days, returning early',
        {
          completeDates: completeDates.size,
        },
      );
      const grouped = groupRecordsByDate(allRecords);
      const sortedDates = Object.keys(grouped).sort((a, b) =>
        b.localeCompare(a),
      );
      const completeDatesToReturn = sortedDates.filter((d) =>
        completeDates.has(d),
      );

      const truncated: Record<
        string,
        ClinicalDocument<BundleEntry<FhirResource>>[]
      > = {};
      let keptCount = 0;
      for (const date of completeDatesToReturn) {
        truncated[date] = grouped[date];
        keptCount += grouped[date].length;
      }

      return {
        records: truncated,
        hasMore: true,
        lastOffset: existingOffset + keptCount,
      };
    }

    if (timeoutExceeded && completeDates.size === 0) {
      console.debug(
        '[fetchRecordsUntilCompleteDays] timeout with 0 complete days, emitting partial',
        {
          uniqueDates: uniqueDates.size,
          totalRecords: allRecords.length,
        },
      );
      if (onPartialResults) {
        onPartialResults({
          records: groupRecordsByDate(allRecords),
          hasMore: true,
          lastOffset: offset,
        });
      }
    }

    if (completeDates.size >= minDays) {
      console.debug(
        '[fetchRecordsUntilCompleteDays] exiting: have enough complete days',
        { completeDates: completeDates.size, minDays },
      );
      break;
    }

    if (hasEnoughDays) {
      const checkBatch = await fetchRawRecords(db, user_id, offset, 1);
      if (checkBatch.length === 0) {
        console.debug(
          '[fetchRecordsUntilCompleteDays] exiting: no more records after exit check',
        );
        hasMore = false;
        break;
      }

      const nextDate = getRecordDateKey(checkBatch[0]);
      const sortedDates = [...uniqueDates].sort();
      const oldestDate = sortedDates[0];

      console.debug('[fetchRecordsUntilCompleteDays] date boundary check', {
        nextDate,
        oldestDate,
        willExit: nextDate !== oldestDate,
      });

      if (nextDate !== oldestDate) {
        console.debug(
          '[fetchRecordsUntilCompleteDays] exiting: date boundary reached',
        );
        break;
      }

      console.debug(
        '[fetchRecordsUntilCompleteDays] continuing: next record same date as oldest',
      );
    }
  }

  const grouped = groupRecordsByDate(allRecords);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (sortedDates.length > minDays) {
    const datesToKeep = new Set(sortedDates.slice(0, minDays));
    const truncated: Record<
      string,
      ClinicalDocument<BundleEntry<FhirResource>>[]
    > = {};
    let keptCount = 0;

    for (const date of sortedDates) {
      if (datesToKeep.has(date)) {
        truncated[date] = grouped[date];
        keptCount += grouped[date].length;
      }
    }

    return {
      records: truncated,
      hasMore: true,
      lastOffset: existingOffset + keptCount,
    };
  }

  if (
    hasMore &&
    completeDates.size >= 1 &&
    completeDates.size < sortedDates.length
  ) {
    console.debug(
      '[fetchRecordsUntilCompleteDays] truncating to complete days at end',
      {
        completeDates: completeDates.size,
        totalDates: sortedDates.length,
      },
    );
    const completeDatesToReturn = sortedDates.filter((d) =>
      completeDates.has(d),
    );
    const truncated: Record<
      string,
      ClinicalDocument<BundleEntry<FhirResource>>[]
    > = {};
    let keptCount = 0;
    for (const date of completeDatesToReturn) {
      truncated[date] = grouped[date];
      keptCount += grouped[date].length;
    }
    return {
      records: truncated,
      hasMore: true,
      lastOffset: existingOffset + keptCount,
    };
  }

  return { records: grouped, hasMore, lastOffset: offset };
}

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
