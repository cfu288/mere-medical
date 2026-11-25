import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
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

type Page = { records: RecordsByDate; cursor: number; hasMore: boolean };

type Loaded = {
  data: RecordsByDate;
  /** Where "load more" starts: a record count, or a page number in a search. */
  cursor: number;
};

export type QueryKey = {
  query: string;
  filters: TimelineFilters;
  userId: string;
};

export type QueryState = {
  /** The newest request. A late response to an older one is ignored. */
  requestId: number;
  /** The search, filters and user that these records belong to. */
  key: QueryKey | undefined;
  /** False until the first records arrive, while the skeleton shows. */
  initialized: boolean;
} & (
  | {
      status: QueryStatus.LOADING;
      /** Shown while waiting: the last search's records, or the first few new ones. */
      data: RecordsByDate | undefined;
    }
  | { status: QueryStatus.ERROR }
  | ({
      status:
        | QueryStatus.SUCCESS
        | QueryStatus.COMPLETE_HIDE_LOAD_MORE
        | QueryStatus.LOAD_MORE_ERROR;
    } & Loaded)
  | ({
      status: QueryStatus.LOADING_MORE;
      /** The part of the next page that has arrived so far. */
      partial: RecordsByDate | undefined;
    } & Loaded)
);

export type QueryAction =
  | { type: 'LOAD_STARTED'; requestId: number; key: QueryKey }
  | { type: 'LOAD_MORE_STARTED'; requestId: number; cursor: number }
  | { type: 'PARTIAL_RESULTS'; requestId: number; records: RecordsByDate }
  | ({ type: 'PAGE_LOADED'; requestId: number } & Page)
  | { type: 'QUERY_FAILED'; requestId: number };

export const initialQueryState: QueryState = {
  requestId: 0,
  key: undefined,
  initialized: false,
  status: QueryStatus.LOADING,
  data: undefined,
};

export function canLoadMore(state: QueryState): state is QueryState & {
  status: QueryStatus.SUCCESS | QueryStatus.LOAD_MORE_ERROR;
} {
  return (
    state.status === QueryStatus.SUCCESS ||
    state.status === QueryStatus.LOAD_MORE_ERROR
  );
}

/**
 * Returns the records already on screen, so the list does not go blank while a
 * new search loads. Returns undefined if they belong to a different user.
 */
function previousResults(
  state: QueryState,
  userId: string,
): RecordsByDate | undefined {
  return 'data' in state && state.key?.userId === userId
    ? state.data
    : undefined;
}

/**
 * Decides what the timeline shows next. Takes the current state and something
 * that happened, such as "a page loaded" or "a request failed", and returns the
 * new state. Events that make no sense in the current state change nothing.
 *
 * - LOAD_STARTED: any state -> LOADING
 * - LOAD_MORE_STARTED: SUCCESS | LOAD_MORE_ERROR -> LOADING_MORE
 * - PARTIAL_RESULTS: stays LOADING | LOADING_MORE
 * - PAGE_LOADED: LOADING | LOADING_MORE -> SUCCESS | COMPLETE_HIDE_LOAD_MORE
 * - QUERY_FAILED: LOADING -> ERROR, LOADING_MORE -> LOAD_MORE_ERROR
 */
export function queryReducer(
  state: QueryState,
  action: QueryAction,
): QueryState {
  const { requestId, initialized, key } = state;
  if (
    action.type !== 'LOAD_STARTED' &&
    action.type !== 'LOAD_MORE_STARTED' &&
    action.requestId !== requestId
  ) {
    console.debug('useRecordQuery: ignoring stale response');
    return state;
  }

  switch (action.type) {
    case 'LOAD_STARTED':
      return {
        requestId: action.requestId,
        initialized,
        key: action.key,
        status: QueryStatus.LOADING,
        data: previousResults(state, action.key.userId),
      };

    case 'LOAD_MORE_STARTED':
      if (!canLoadMore(state) || state.cursor !== action.cursor) return state;
      return {
        requestId: action.requestId,
        initialized,
        key,
        status: QueryStatus.LOADING_MORE,
        data: state.data,
        cursor: state.cursor,
        partial: undefined,
      };

    case 'PARTIAL_RESULTS':
      if (state.status === QueryStatus.LOADING) {
        return { ...state, initialized: true, data: action.records };
      }
      if (state.status === QueryStatus.LOADING_MORE) {
        return { ...state, partial: action.records };
      }
      return state;

    case 'PAGE_LOADED':
      if (
        state.status !== QueryStatus.LOADING &&
        state.status !== QueryStatus.LOADING_MORE
      ) {
        return state;
      }
      return {
        requestId,
        initialized: true,
        key,
        status: action.hasMore
          ? QueryStatus.SUCCESS
          : QueryStatus.COMPLETE_HIDE_LOAD_MORE,
        data:
          state.status === QueryStatus.LOADING_MORE
            ? mergeRecordsByDate(state.data, action.records)
            : action.records,
        cursor: action.cursor,
      };

    case 'QUERY_FAILED':
      if (state.status === QueryStatus.LOADING) {
        return { requestId, initialized, key, status: QueryStatus.ERROR };
      }
      if (state.status === QueryStatus.LOADING_MORE) {
        return {
          requestId,
          initialized,
          key,
          status: QueryStatus.LOAD_MORE_ERROR,
          data: state.data,
          cursor: state.cursor,
        };
      }
      return state;
  }
}

async function fetchGroupedPage(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  minCompleteDays: number,
  offset: number,
  filters: TimelineFilters,
  onPartialResults: (records: RecordsByDate) => void,
): Promise<Page> {
  console.debug('useRecordQuery: grouped view', { offset });

  const result = await fetchRecordsUntilCompleteDays(
    db,
    userId,
    minCompleteDays,
    offset,
    3000,
    (partial) => onPartialResults(partial.records),
    filters,
  );

  console.debug('useRecordQuery: grouped result', {
    days: Object.keys(result.records).length,
    hasMore: result.hasMore,
    lastOffset: result.lastOffset,
  });

  return {
    records: result.records,
    cursor: result.lastOffset,
    hasMore: result.hasMore,
  };
}

async function fetchSearchPage(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  query: string,
  page: number,
  filters: TimelineFilters,
): Promise<Page> {
  console.debug('useRecordQuery: search query', { query, page });

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

  return { records, cursor: page + 1, hasMore };
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
 * @returns The records to show grouped by day (`data`), whether they are loading,
 * loaded or failed (`status`), and functions to load more or try again.
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
  retry: () => void;
  showIndividualItems: boolean;
} {
  const db = useRxDb();
  const user = useUser();
  const requestIdRef = useRef(0);

  const [state, dispatch] = useReducer(queryReducer, initialQueryState);

  // do the records in `state` answer the search on screen, or an earlier one?
  const isCurrent =
    state.key?.query === query &&
    state.key.filters === filters &&
    state.key.userId === user.id;

  const execQuery = useCallback(
    async (loadMore: boolean) => {
      let cursor = 0;
      if (loadMore) {
        if (!isCurrent || !canLoadMore(state)) return;
        cursor = state.cursor;
      }
      const requestId = ++requestIdRef.current;
      dispatch(
        loadMore
          ? { type: 'LOAD_MORE_STARTED', requestId, cursor }
          : {
              type: 'LOAD_STARTED',
              requestId,
              key: { query, filters, userId: user.id },
            },
      );

      try {
        const page = query
          ? await fetchSearchPage(db, user.id, query, cursor, filters)
          : await fetchGroupedPage(
              db,
              user.id,
              minCompleteDays,
              cursor,
              filters,
              (records) =>
                dispatch({ type: 'PARTIAL_RESULTS', requestId, records }),
            );
        dispatch({ type: 'PAGE_LOADED', requestId, ...page });
      } catch (e) {
        console.error(e);
        dispatch({ type: 'QUERY_FAILED', requestId });
      }
    },
    [db, user.id, query, filters, minCompleteDays, state, isCurrent],
  );

  const execQueryRef = useRef(execQuery);
  execQueryRef.current = execQuery;

  const loadNextPage = useDebounceCallback(
    () => execQueryRef.current(true),
    300,
  );

  const retry = useCallback(() => {
    execQueryRef.current(false);
  }, []);

  useEffect(() => {
    execQueryRef.current(false);
  }, [query, filters, user.id]);

  const data = useMemo(() => {
    if (!isCurrent) return previousResults(state, user.id);
    if (state.status === QueryStatus.ERROR) return undefined;
    if (state.status === QueryStatus.LOADING_MORE && state.partial) {
      return mergeRecordsByDate(state.data, state.partial);
    }
    return state.data;
  }, [state, isCurrent, user.id]);

  return {
    data,
    status: isCurrent ? state.status : QueryStatus.LOADING,
    initialized: state.initialized,
    loadNextPage,
    retry,
    showIndividualItems: !!query,
  };
}
