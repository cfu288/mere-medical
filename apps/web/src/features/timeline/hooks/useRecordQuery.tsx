import { useCallback, useEffect, useReducer, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { useDebounceCallback } from '@react-hook/debounce';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { useUser } from '../../../app/providers/UserProvider';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { QueryStatus, RecordsByDate } from '../types';
import { fetchRecords, PAGE_SIZE } from '../TimelineTab';
import { findTimelineDocuments } from '../../../repositories/ClinicalDocumentRepository';
import {
  NO_FILTERS,
  TimelineFilters,
  toTimelineQuery,
} from '../timelineFilters';

export const GROUPED_VIEW_BATCH_SIZE = 250;

export async function fetchRawRecords(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
  offset: number,
  limit: number,
  filters: TimelineFilters = NO_FILTERS,
): Promise<ClinicalDocument<BundleEntry<FhirResource>>[]> {
  return findTimelineDocuments<BundleEntry<FhirResource>>(db, user_id, {
    skip: offset,
    limit,
    ...toTimelineQuery(filters),
  });
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

/**
 * Cuts a page at the first record of a day that is not in `days`.
 *
 * The page must be a prefix of `records`, because the next page starts at
 * `lastOffset`. The database sorts by the date text, and the day comes from the
 * local date, so the two orders differ when the dates mix formats or UTC
 * offsets. The day of the first record is always kept, so a page is never empty.
 *
 * `hasMore` says if the database has records after `records`.
 */
function takeLeadingDays(
  records: ClinicalDocument<BundleEntry<FhirResource>>[],
  days: Set<string>,
  existingOffset: number,
  hasMore: boolean,
) {
  const firstDay = getRecordDateKey(records[0]);
  const end = records.findIndex((record) => {
    const day = getRecordDateKey(record);
    return day !== firstDay && !days.has(day);
  });
  const kept = end === -1 ? records : records.slice(0, end);
  return {
    records: groupRecordsByDate(kept),
    hasMore: hasMore || kept.length < records.length,
    lastOffset: existingOffset + kept.length,
  };
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
  minDays = 5,
  existingOffset = 0,
  timeoutMs = 3000,
  onPartialResults?: PartialResultsCallback,
  filters: TimelineFilters = NO_FILTERS,
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

  for (;;) {
    iteration++;
    const batchStartTime = Date.now();
    const batch = await fetchRawRecords(
      db,
      user_id,
      offset,
      GROUPED_VIEW_BATCH_SIZE,
      filters,
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
      return takeLeadingDays(
        allRecords,
        completeDates,
        existingOffset,
        hasMore,
      );
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
      const checkBatch = await fetchRawRecords(db, user_id, offset, 1, filters);
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
    return takeLeadingDays(
      allRecords,
      new Set(sortedDates.slice(0, minDays)),
      existingOffset,
      hasMore,
    );
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
    return takeLeadingDays(allRecords, completeDates, existingOffset, hasMore);
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
  filters: TimelineFilters,
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
    filters,
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
  dispatch: React.Dispatch<QueryAction>,
  filters: TimelineFilters,
): Promise<void> {
  console.debug('useRecordQuery: search query', { query, page, loadMore });

  const records = await fetchRecords(db, userId, query, page, filters);

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
 *
 * @param query - Search query string. Empty string triggers grouped view mode.
 * @param filters - Record types and date range applied in both modes. Pass a
 * stable object (e.g. from useState); a new object re-runs the query.
 * @param minCompleteDays - Minimum number of complete days to fetch in grouped view (default: 3)
 */
export function useRecordQuery(
  query: string,
  filters: TimelineFilters = NO_FILTERS,
  minCompleteDays = 3,
): {
  data: RecordsByDate | undefined;
  status: QueryStatus;
  initialized: boolean;
  loadNextPage: () => void;
  showIndividualItems: boolean;
} {
  const db = useRxDb();
  const user = useUser();
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
            filters,
          );
        } else {
          const page = loadMore ? state.searchPage + 1 : 0;
          await executeSearchQuery(
            db,
            user.id,
            query,
            page,
            loadMore,
            guardedDispatch,
            filters,
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
      filters,
      isGroupedView,
      state.groupedOffset,
      state.searchPage,
      minCompleteDays,
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
  }, [query, filters]);

  return {
    data: state.data,
    status: state.status,
    initialized: state.initialized,
    loadNextPage,
    showIndividualItems,
  };
}
