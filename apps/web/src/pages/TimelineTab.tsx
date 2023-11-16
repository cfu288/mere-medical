import { format, parseISO } from 'date-fns';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DatabaseCollections,
  useRxDb,
} from '../components/providers/RxDbProvider';
import { MangoQuerySelector, RxDatabase, RxDocument } from 'rxdb';
import { EmptyRecordsPlaceholder } from '../components/EmptyRecordsPlaceholder';
import { useUser } from '../components/providers/UserProvider';
import { AppPage } from '../components/AppPage';
import { JumpToPanel } from '../components/timeline/JumpToPanel';
import { TimelineBanner } from '../components/timeline/TimelineBanner';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import { TimelineItem } from '../components/timeline/TimelineItem';
import { TimelineYearHeaderWrapper } from '../components/timeline/TimelineYearHeaderWrapper';
import { useDebounceCallback } from '@react-hook/debounce';
import { TimelineSkeleton } from './TimelineSkeleton';
import { useScrollToHash } from '../components/hooks/useScrollToHash';
import { SearchBar } from './SearchBar';
import { Transition } from '@headlessui/react';
import { ButtonLoadingSpinner } from '../components/connection/ButtonLoadingSpinner';

/**
 * This should really be a background process that runs after every data sync instead of every view
 * @param db
 * @returns
 */
async function fetchRecords(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
  query?: string,
  page?: number
) {
  const parsedQuery = query?.trim() === '' ? undefined : query;
  let selector: MangoQuerySelector<ClinicalDocument<unknown>> = {
    user_id: user_id,
    'data_record.resource_type': {
      $nin: [
        'patient',
        'observation',
        'careplan',
        'allergyintolerance',
        'documentreference_attachment',
      ],
    },
    'metadata.date': { $nin: [null, undefined, ''] },
  };
  if (parsedQuery) {
    selector['data_record.resource_type']['$nin'] = [
      'patient',
      'careplan',
      'allergyintolerance',
      'documentreference_attachment',
    ];
    selector = {
      ...selector,
      'metadata.display_name': { $regex: `.*${parsedQuery}.*`, $options: 'si' },
    };
  }
  const gr = db.clinical_documents
    .find({
      selector,
      sort: [{ 'metadata.date': 'desc' }],
    })
    .skip(page ? page * PAGE_SIZE : 0)
    .limit(PAGE_SIZE)
    .exec()
    .then((list) => {
      const lst = list as unknown as RxDocument<
        ClinicalDocument<BundleEntry<FhirResource>>
      >[];

      // Group records by date
      const groupedRecords: Record<
        string, // date to group by
        ClinicalDocument<BundleEntry<FhirResource>>[] // documents/cards for date
      > = {};

      lst.forEach((item) => {
        if (item.get('metadata')?.date === undefined) {
          console.warn('Date is undefined for object:');
          console.log(item.toJSON());
        } else {
          const date = item.get('metadata')?.date
            ? format(parseISO(item.get('metadata')?.date), 'yyyy-MM-dd')
            : '-1';
          if (groupedRecords[date]) {
            groupedRecords[date].push(
              item.toMutableJSON() as ClinicalDocument<
                BundleEntry<FhirResource>
              >
            );
          } else {
            groupedRecords[date] = [item.toMutableJSON()];
          }
        }
      });

      console.debug(groupedRecords);

      return groupedRecords;
    });

  return gr;
}

export enum QueryStatus {
  IDLE,
  LOADING,
  LOADING_MORE,
  SUCCESS,
  ERROR,
  COMPLETE,
}

const PAGE_SIZE = 250;

function useRecordQuery(
  query: string
): [
  Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]> | undefined,
  QueryStatus,
  boolean,
  () => void
] {
  const db = useRxDb(),
    user = useUser(),
    hasRun = useRef(false),
    [queryStatus, setQueryStatus] = useState(QueryStatus.IDLE),
    [initialized, setInitialized] = useState(false),
    [list, setList] =
      useState<Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>>(),
    [currentPage, setCurrentPage] = useState(0),
    execQuery = useCallback(
      /**
       *
       * @param merge Merge results with existing results. If false, results overwrite existing results
       * @param loadMore Indicate whether this is an inital load or a load more query. Affects visual loading state
       */
      async (merge = true, loadMore = false) => {
        loadMore && setQueryStatus(QueryStatus.LOADING_MORE);
        try {
          const groupedRecords = await fetchRecords(
            db,
            user.id,
            query,
            loadMore ? currentPage + 1 : currentPage
          );
          loadMore && setCurrentPage(currentPage + 1);
          if (merge) {
            setList({ ...list, ...groupedRecords });
          } else {
            setList(groupedRecords);
          }
          if (
            Object.values(groupedRecords).reduce((a, b) => a + b.length, 0) <
            PAGE_SIZE
          ) {
            setQueryStatus(QueryStatus.COMPLETE);
          } else {
            setQueryStatus(QueryStatus.SUCCESS);
          }
          setInitialized(true);
        } catch (e) {
          setQueryStatus(QueryStatus.ERROR);
        }
      },
      [currentPage, db, list, query, user.id]
    ),
    debounceExecQuery = useDebounceCallback(() => execQuery(false, false), 150),
    loadNextPage = () => execQuery(true, true);

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      setQueryStatus(QueryStatus.LOADING);
      execQuery();
    }
  }, [execQuery, query]);

  useEffect(() => {
    setQueryStatus(QueryStatus.LOADING);
    debounceExecQuery();
  }, [query, debounceExecQuery]);

  return [list, queryStatus, initialized, loadNextPage];
}

export function TimelineTab() {
  const user = useUser(),
    [query, setQuery] = useState(''),
    [data, status, initialized, loadNextPage] = useRecordQuery(query),
    hasNoRecords = query === '' && (!data || Object.entries(data).length === 0),
    hasRecords =
      (data !== undefined && Object.entries(data).length > 0) ||
      (query !== '' && data !== undefined);

  useScrollToHash();

  const listItems = useMemo(
    () =>
      data ? (
        <>
          {Object.entries(data).map(([dateKey, itemList], index, elements) => (
            <TimelineYearHeaderWrapper
              key={dateKey}
              dateKey={dateKey}
              index={index}
              elements={elements}
            >
              <TimelineItem dateKey={dateKey} itemList={itemList} />
            </TimelineYearHeaderWrapper>
          ))}
          {status !== QueryStatus.COMPLETE && (
            <button
              disabled={status === QueryStatus.LOADING_MORE}
              className="border-1 hover:bg-primary-700 mt-6 w-full rounded border border-gray-300 py-2 px-4 font-bold hover:text-white disabled:bg-white disabled:text-gray-600"
              onClick={loadNextPage}
            >
              Load more records
              <span className="ml-2 inline-flex justify-center align-middle">
                {status === QueryStatus.LOADING_MORE ? (
                  <ButtonLoadingSpinner />
                ) : null}
              </span>
            </button>
          )}
        </>
      ) : (
        []
      ),
    [data, loadNextPage, status]
  );

  return (
    <AppPage
      banner={
        <TimelineBanner
          image={
            user?.profile_picture?.data ? user.profile_picture.data : undefined
          }
          text={
            user?.first_name ? `Welcome back ${user.first_name}!` : 'Hello!'
          }
        />
      }
    >
      <Transition
        show={
          !initialized &&
          (status === QueryStatus.IDLE || status === QueryStatus.LOADING)
        }
        enter="transition-opacity ease-in-out duration-75"
        enterFrom="opacity-75"
        enterTo="opacity-100"
        leave="transition-opacity ease-in-out duration-75"
        leaveFrom="opacity-100"
        leaveTo="opacity-75"
      >
        <TimelineSkeleton />
      </Transition>
      <Transition
        as="div"
        className={'relative flex h-full'}
        show={initialized}
        enter="transition-opacity ease-in-out duration-75"
        enterFrom="opacity-75"
        enterTo="opacity-100"
        leave="transition-opacity ease-in-out duration-75"
        leaveFrom="opacity-100"
        leaveTo="opacity-75"
      >
        {hasNoRecords ? (
          <div className="mx-auto w-full max-w-4xl gap-x-4 px-4 pt-2 pb-4 sm:px-6 lg:px-8">
            <EmptyRecordsPlaceholder />
          </div>
        ) : null}
        {hasRecords ? (
          <div className="flex w-full overflow-hidden">
            <JumpToPanel items={data} isLoading={false} />
            <div className="px-auto flex h-full max-h-full w-full justify-center overflow-y-scroll">
              <div className="h-max w-full max-w-4xl flex-col px-4 pb-20 sm:px-6 sm:pb-6 lg:px-8">
                <SearchBar query={query} setQuery={setQuery} status={status} />
                {listItems}
                {hasNoRecords ? (
                  <p className="font-xl">{`No records found with query: ${query}`}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Transition>
    </AppPage>
  );
}
