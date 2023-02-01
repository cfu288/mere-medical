import { format, parseISO } from 'date-fns';
import { BundleEntry, FhirResource } from 'fhir/r2';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DatabaseCollections,
  useRxDb,
} from '../components/providers/RxDbProvider';
import { MangoQuerySelector, RxDatabase, RxDocument } from 'rxdb';
import { EmptyRecordsPlaceholder } from '../components/EmptyRecordsPlaceholder';
import { useUser } from '../components/providers/UserProvider';
import { AppPage } from '../components/AppPage';
import { useLocation } from 'react-router-dom';
import { JumpToPanel } from '../components/timeline/JumpToPanel';
import { TimelineBanner } from '../components/timeline/TimelineBanner';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import { TimelineItem } from '../components/timeline/TimelineItem';
import { TimelineYearHeaderWrapper } from '../components/timeline/TimelineYearHeaderWrapper';
import { useDebounceCallback } from '@react-hook/debounce';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ButtonLoadingSpinner } from '../components/connection/ButtonLoadingSpinner';
import { SkeletonTimelineCard } from '../components/timeline/SkeletonTimelineCard';

/**
 * This should really be a background process that runs after every data sync instead of every view
 * @param db
 * @returns
 */
function fetchRecords(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
  query?: string
) {
  let selector: MangoQuerySelector<ClinicalDocument<unknown>> = {
    user_id: user_id,
    'data_record.resource_type': {
      $nin: ['patient', 'observation', 'careplan', 'allergyintolerance'],
    },
    'metadata.date': { $nin: [null, undefined, ''] },
  };
  if (query) {
    selector = {
      ...selector,
      'metadata.display_name': { $regex: `.*${query}.*`, $options: 'si' },
    };
  }
  return db.clinical_documents
    .find({
      selector,
      sort: [{ 'metadata.date': 'desc' }],
    })
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

      return groupedRecords;
    });
}

function useScrollToHash() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    setTimeout(() => {
      const id = hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest',
        });
      }
    }, 0);
  }, [pathname, hash, key]); // do this on route change
}

enum QueryStatus {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR,
}

function useRecordQuery(
  query: string
): [
  Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]> | undefined,
  QueryStatus,
  boolean
] {
  const db = useRxDb(),
    user = useUser(),
    [queryStatus, setQueryStatus] = useState(QueryStatus.IDLE),
    [initialized, setInitialized] = useState(false),
    [list, setList] =
      useState<Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>>(),
    debounceExecQuery = useDebounceCallback((query) => {
      fetchRecords(db, user.id, query)
        .then((groupedRecords) => {
          setList(groupedRecords);
          console.debug(groupedRecords);
          setQueryStatus(QueryStatus.SUCCESS);
          setInitialized(true);
        })
        .catch(() => {
          setQueryStatus(QueryStatus.ERROR);
        });
    }, 150);

  useEffect(() => {
    setQueryStatus(QueryStatus.LOADING);
    debounceExecQuery(query);
  }, [debounceExecQuery, query]);

  return [list, queryStatus, initialized];
}

function TimelineTab() {
  const user = useUser(),
    [query, setQuery] = useState(''),
    [data, status, initialized] = useRecordQuery(query),
    hasNoRecords = query === '' && (!data || Object.entries(data).length === 0),
    hasRecords =
      (data && Object.entries(data).length) || (query !== '' && data);

  useScrollToHash();

  const listItems = useMemo(
    () =>
      data
        ? Object.entries(data).map(([dateKey, itemList], index, elements) => (
            <TimelineYearHeaderWrapper
              key={dateKey}
              dateKey={dateKey}
              index={index}
              elements={elements}
            >
              <TimelineItem dateKey={dateKey} itemList={itemList} />
            </TimelineYearHeaderWrapper>
          ))
        : [],
    [data]
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
      {!initialized &&
        (status === QueryStatus.IDLE || status === QueryStatus.LOADING) && (
          <TimelineSkeleton />
        )}
      <div className={`relative flex ${initialized ? 'block' : 'hidden'}`}>
        {hasRecords ? <JumpToPanel list={data} /> : null}
        {hasNoRecords ? (
          <div className="mx-auto w-full max-w-4xl gap-x-4 px-4 pt-2 pb-4 sm:px-6 lg:px-8">
            <EmptyRecordsPlaceholder />
          </div>
        ) : null}
        {hasRecords ? (
          <div className="mx-auto flex w-full max-w-4xl flex-col overflow-x-clip px-4 pb-12 sm:px-6 lg:px-8">
            <SearchBar query={query} setQuery={setQuery} status={status} />
            {listItems}
            {hasNoRecords ? (
              <p className="font-xl">{`No records found with query: ${query}`}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppPage>
  );
}

export default TimelineTab;

function TimelineSkeletonUnmemoed() {
  return (
    <div className={`relative flex`}>
      <SkeletonJumpToPanel />
      <div className="mx-auto flex w-full max-w-4xl flex-col overflow-x-clip px-4 pb-12 sm:px-6 lg:px-8">
        <SkeletonSearchBar />
        <TimelineYearHeaderSkeleton />
        <div className="flex scroll-mt-10 flex-row gap-x-4 px-0 pt-8 md:px-2">
          {/* Left sided date */}
          <div className="flex h-4 grow animate-pulse flex-row items-center justify-end  pt-5 ">
            <div className="mt-1 h-3 w-12 rounded-sm bg-gray-100 "></div>
          </div>
          {/* Spacer between date and card */}
          <div className="flex-column  relative flex justify-center pt-3 font-black text-gray-400">
            <div className="">•</div>
          </div>
          {/* Clinical card rendering */}
          <div className="flex w-4/5 flex-col gap-y-2 md:w-3/4">
            <SkeletonTimelineCard />
            <SkeletonTimelineCard />
            <SkeletonTimelineCard />
            <SkeletonTimelineCard />
            <SkeletonTimelineCard />
          </div>
        </div>
        <TimelineYearHeaderSkeleton />
        <div className="flex scroll-mt-10 flex-row gap-x-4 px-0 pt-8 md:px-2">
          {/* Left sided date */}
          <div className="flex h-4 grow animate-pulse flex-row items-center justify-end  pt-5 ">
            <div className="mt-1 h-3 w-12 rounded-sm bg-gray-100 "></div>
          </div>
          {/* Spacer between date and card */}
          <div className="flex-column  relative flex justify-center pt-3 font-black text-gray-400">
            <div className="">•</div>
          </div>
          {/* Clinical card rendering */}
          <div className="flex w-4/5 flex-col gap-y-2 md:w-3/4">
            <SkeletonTimelineCard />
            <SkeletonTimelineCard />
            <SkeletonTimelineCard />
            <SkeletonTimelineCard />
            <SkeletonTimelineCard />
          </div>
        </div>
      </div>
    </div>
  );
}

const TimelineSkeleton = memo(TimelineSkeletonUnmemoed);

function SkeletonSearchBar() {
  return (
    <div className="mt-6 mb-1 w-full">
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ">
          <svg
            aria-hidden="true"
            className="h-5 w-5 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </div>
        <input
          tabIndex={1}
          type="text"
          name="search"
          id="search"
          placeholder="Search your medical records"
          className="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-md border-gray-300 pl-10 pr-12 shadow-sm sm:text-sm"
        />
      </div>
    </div>
  );
}

function SearchBar({
  query,
  setQuery,
  status,
}: {
  query: string;
  setQuery: (s: string) => void;
  status: QueryStatus;
}) {
  return (
    <div className="mt-6 mb-1 w-full">
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ">
          <svg
            aria-hidden="true"
            className="h-5 w-5 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </div>
        <input
          tabIndex={1}
          type="text"
          name="search"
          id="search"
          placeholder="Search your medical records"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-md border-gray-300 pl-10 pr-12 shadow-sm sm:text-sm"
        />
        <div className="absolute inset-y-0 right-0 flex py-1.5 pr-1.5">
          <div className="inline-flex items-center px-2 ">
            {status === QueryStatus.LOADING && <ButtonLoadingSpinner />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TimelineYearHeaderSkeleton() {
  return (
    <div
      className="sticky top-0 left-0 z-10 flex flex-col bg-white pt-4"
      style={{
        position: '-webkit-sticky',
      }}
    >
      <div className="relative flex flex-row py-1">
        <div className="absolute -top-2 h-2 w-full bg-gradient-to-t from-white"></div>
        <span className="flex grow"></span>
        <div className="w-full">
          <div className="mt-1 h-5 w-40 rounded-sm bg-gray-100 "></div>
        </div>
        <div className="absolute -bottom-4 h-4 w-full bg-gradient-to-b from-white"></div>
      </div>
    </div>
  );
}

function SkeletonJumpToPanel() {
  return (
    <div className="sticky top-0 hidden h-screen min-h-full w-0 flex-col overflow-y-scroll border-gray-200 bg-gray-50 text-slate-800 lg:flex lg:w-auto lg:border-r-2">
      <p className="sticky top-0 mr-2 h-10 whitespace-nowrap bg-gray-50 p-2 font-bold">
        Jump To
      </p>
      <ul>
        {[...Array(50)].map(() => (
          <li>
            <div className="flex h-4 animate-pulse flex-row items-center pt-5 ">
              <div className="ml-4 h-3 w-12 rounded-sm bg-gray-100 p-1 "></div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
