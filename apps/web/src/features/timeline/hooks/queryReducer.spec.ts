import { QueryStatus, RecordsByDate } from '../types';
import { NO_FILTERS } from '../timelineFilters';
import {
  initialQueryState,
  queryReducer,
  QueryAction,
  QueryKey,
  QueryState,
} from './useRecordQuery';

const day = (date: string, ...ids: string[]) =>
  ({ [date]: ids.map((id) => ({ id })) }) as unknown as RecordsByDate;

const key: QueryKey = { query: '', filters: NO_FILTERS, userId: 'user-a' };

const run = (actions: QueryAction[], from: QueryState = initialQueryState) =>
  actions.reduce(queryReducer, from);

const loaded = run([
  { type: 'LOAD_STARTED', requestId: 1, key },
  {
    type: 'PAGE_LOADED',
    requestId: 1,
    records: day('2024-01-02', 'a'),
    cursor: 1,
    hasMore: true,
  },
]);

describe('queryReducer', () => {
  it('loads the first page', () => {
    expect(loaded).toEqual({
      requestId: 1,
      key,
      initialized: true,
      status: QueryStatus.SUCCESS,
      data: day('2024-01-02', 'a'),
      cursor: 1,
    });
  });

  it('hides load more when no records remain', () => {
    const state = run([
      { type: 'LOAD_STARTED', requestId: 1, key },
      {
        type: 'PAGE_LOADED',
        requestId: 1,
        records: {},
        cursor: 0,
        hasMore: false,
      },
    ]);
    expect(state.status).toBe(QueryStatus.COMPLETE_HIDE_LOAD_MORE);
  });

  it('keeps the previous results while a new query loads', () => {
    const state = run([{ type: 'LOAD_STARTED', requestId: 2, key }], loaded);
    expect(state).toMatchObject({
      status: QueryStatus.LOADING,
      data: day('2024-01-02', 'a'),
    });
  });

  it('drops the previous results when the new query fails', () => {
    const state = run(
      [
        { type: 'LOAD_STARTED', requestId: 2, key },
        { type: 'QUERY_FAILED', requestId: 2 },
      ],
      loaded,
    );
    expect(state).toEqual({
      requestId: 2,
      key,
      initialized: true,
      status: QueryStatus.ERROR,
    });
  });

  it('cannot load more on top of a failed query', () => {
    const failed = run(
      [
        { type: 'LOAD_STARTED', requestId: 2, key },
        { type: 'QUERY_FAILED', requestId: 2 },
      ],
      loaded,
    );
    expect(
      run([{ type: 'LOAD_MORE_STARTED', requestId: 3, cursor: 1 }], failed),
    ).toBe(failed);
  });

  it('retries a failed query', () => {
    const state = run([
      { type: 'LOAD_STARTED', requestId: 1, key },
      { type: 'QUERY_FAILED', requestId: 1 },
      { type: 'LOAD_STARTED', requestId: 2, key },
    ]);
    expect(state).toEqual({
      requestId: 2,
      key,
      initialized: false,
      status: QueryStatus.LOADING,
      data: undefined,
    });
  });

  it('ignores the response of a superseded request', () => {
    const loading = run([{ type: 'LOAD_STARTED', requestId: 2, key }], loaded);
    const state = run(
      [
        {
          type: 'PAGE_LOADED',
          requestId: 1,
          records: day('2023-01-01', 'old'),
          cursor: 9,
          hasMore: false,
        },
        { type: 'QUERY_FAILED', requestId: 1 },
      ],
      loading,
    );
    expect(state).toBe(loading);
  });

  it('does not start load more while the first page loads', () => {
    const loading = run([{ type: 'LOAD_STARTED', requestId: 1, key }]);
    expect(
      run([{ type: 'LOAD_MORE_STARTED', requestId: 2, cursor: 1 }], loading),
    ).toBe(loading);
  });

  it('does not restart a load more that is running', () => {
    const loadingMore = run(
      [{ type: 'LOAD_MORE_STARTED', requestId: 2, cursor: 1 }],
      loaded,
    );
    expect(
      run(
        [{ type: 'LOAD_MORE_STARTED', requestId: 3, cursor: 1 }],
        loadingMore,
      ),
    ).toBe(loadingMore);
  });

  it('appends the next page once, after partial results', () => {
    const state = run(
      [
        { type: 'LOAD_MORE_STARTED', requestId: 2, cursor: 1 },
        {
          type: 'PARTIAL_RESULTS',
          requestId: 2,
          records: day('2024-01-01', 'b'),
        },
        {
          type: 'PARTIAL_RESULTS',
          requestId: 2,
          records: day('2024-01-01', 'b', 'c'),
        },
      ],
      loaded,
    );
    expect(state).toMatchObject({
      status: QueryStatus.LOADING_MORE,
      data: day('2024-01-02', 'a'),
      partial: day('2024-01-01', 'b', 'c'),
    });

    const done = run(
      [
        {
          type: 'PAGE_LOADED',
          requestId: 2,
          records: day('2024-01-01', 'b', 'c', 'd'),
          cursor: 4,
          hasMore: true,
        },
      ],
      state,
    );
    expect(done).toEqual({
      requestId: 2,
      key,
      initialized: true,
      status: QueryStatus.SUCCESS,
      data: { ...day('2024-01-02', 'a'), ...day('2024-01-01', 'b', 'c', 'd') },
      cursor: 4,
    });
  });

  it('keeps the loaded pages and the cursor when load more fails', () => {
    const state = run(
      [
        { type: 'LOAD_MORE_STARTED', requestId: 2, cursor: 1 },
        {
          type: 'PARTIAL_RESULTS',
          requestId: 2,
          records: day('2024-01-01', 'b'),
        },
        { type: 'QUERY_FAILED', requestId: 2 },
      ],
      loaded,
    );
    expect(state).toEqual({
      requestId: 2,
      key,
      initialized: true,
      status: QueryStatus.LOAD_MORE_ERROR,
      data: day('2024-01-02', 'a'),
      cursor: 1,
    });
    expect(
      run([{ type: 'LOAD_MORE_STARTED', requestId: 3, cursor: 1 }], state)
        .status,
    ).toBe(QueryStatus.LOADING_MORE);
  });

  it('shows partial results of the first page', () => {
    const state = run([
      { type: 'LOAD_STARTED', requestId: 1, key },
      {
        type: 'PARTIAL_RESULTS',
        requestId: 1,
        records: day('2024-01-02', 'a'),
      },
    ]);
    expect(state).toEqual({
      requestId: 1,
      key,
      initialized: true,
      status: QueryStatus.LOADING,
      data: day('2024-01-02', 'a'),
    });
  });

  it('does not start load more with the cursor of a replaced query', () => {
    expect(
      run([{ type: 'LOAD_MORE_STARTED', requestId: 2, cursor: 7 }], loaded),
    ).toBe(loaded);
  });

  it('does not start load more when no records remain', () => {
    const complete = run(
      [
        { type: 'LOAD_MORE_STARTED', requestId: 2, cursor: 1 },
        {
          type: 'PAGE_LOADED',
          requestId: 2,
          records: {},
          cursor: 1,
          hasMore: false,
        },
      ],
      loaded,
    );
    expect(
      run([{ type: 'LOAD_MORE_STARTED', requestId: 3, cursor: 1 }], complete),
    ).toBe(complete);
  });

  it('drops a partial next page when the query changes', () => {
    const state = run(
      [
        { type: 'LOAD_MORE_STARTED', requestId: 2, cursor: 1 },
        {
          type: 'PARTIAL_RESULTS',
          requestId: 2,
          records: day('2024-01-01', 'b'),
        },
        { type: 'LOAD_STARTED', requestId: 3, key },
        {
          type: 'PARTIAL_RESULTS',
          requestId: 2,
          records: day('2024-01-01', 'b', 'c'),
        },
      ],
      loaded,
    );
    expect(state).toStrictEqual({
      requestId: 3,
      key,
      initialized: true,
      status: QueryStatus.LOADING,
      data: day('2024-01-02', 'a'),
    });
  });

  it('replaces the previous results with partial results of the new query', () => {
    const state = run(
      [
        { type: 'LOAD_STARTED', requestId: 2, key },
        {
          type: 'PARTIAL_RESULTS',
          requestId: 2,
          records: day('2023-05-05', 'z'),
        },
      ],
      loaded,
    );
    expect(state).toMatchObject({ data: day('2023-05-05', 'z') });
  });

  it('appends a next page that continues a loaded day', () => {
    const state = run(
      [
        { type: 'LOAD_MORE_STARTED', requestId: 2, cursor: 1 },
        {
          type: 'PAGE_LOADED',
          requestId: 2,
          records: day('2024-01-02', 'b'),
          cursor: 2,
          hasMore: false,
        },
      ],
      loaded,
    );
    expect(state).toMatchObject({ data: day('2024-01-02', 'a', 'b') });
  });

  it('drops the previous results when the user changes', () => {
    const state = run(
      [
        {
          type: 'LOAD_STARTED',
          requestId: 2,
          key: { ...key, userId: 'user-b' },
        },
      ],
      loaded,
    );
    expect(state).toMatchObject({
      status: QueryStatus.LOADING,
      data: undefined,
    });
  });
});
