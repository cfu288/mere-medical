import { differenceInDays, format, parseISO } from 'date-fns';
import { BundleEntry, FhirResource } from 'fhir/r2';
import {
  UIEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MangoQuerySelector, RxDatabase, RxDocument } from 'rxdb';

import { Transition } from '@headlessui/react';
import { ArrowUpIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { IVSSimilaritySearchParams, VectorStorage } from '@mere/vector-storage';
import { useDebounceCallback } from '@react-hook/debounce';

import { AppPage } from '../components/AppPage';
import { ButtonLoadingSpinner } from '../components/connection/ButtonLoadingSpinner';
import { EmptyRecordsPlaceholder } from '../components/EmptyRecordsPlaceholder';
import useIntersectionObserver from '../components/hooks/useIntersectionObserver';
import { useScrollToHash } from '../components/hooks/useScrollToHash';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { useLocalConfig } from '../components/providers/LocalConfigProvider';
import { useUser } from '../components/providers/UserProvider';
import { JumpToPanel } from '../components/timeline/JumpToPanel';
import { SearchBar } from '../components/timeline/SearchBar';
import { TimelineBanner } from '../components/timeline/TimelineBanner';
import { TimelineItem } from '../components/timeline/TimelineItem';
import { TimelineSkeleton } from '../components/timeline/TimelineSkeleton';
import { TimelineYearHeader } from '../components/timeline/TimelineYearHeader';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import { TimelineMonthDayHeader } from '../components/timeline/TimelineMonthDayHeader';
import { useRecordQuery } from '../components/hooks/useRecordQuery';

export enum QueryStatus {
  IDLE,
  LOADING, // Initial load and queries with page === 0
  LOADING_MORE, // Currently loading more results using loadNextPage
  SUCCESS,
  ERROR,
  COMPLETE_HIDE_LOAD_MORE, // Indicates that there are no more results to load using loadNextPage
}

export function TimelineTab() {
  const user = useUser(),
    [query, setQuery] = useState(''),
    { experimental__use_openai_rag } = useLocalConfig(),
    { data, status, initialized, loadNextPage, showIndividualItems } =
      useRecordQuery(query, experimental__use_openai_rag),
    hasNoRecords = query === '' && (!data || Object.entries(data).length === 0),
    scrollContainer = useRef<HTMLDivElement>(null),
    scrollToTop = useScrollToTop(scrollContainer),
    onScroll: UIEventHandler<HTMLDivElement> = useDebounceCallback((e) => {
      if (e) {
        setScrollY(
          onScrollGetYPosition(e.target ? e.target : (e as any).srcElement),
        );
      }
    }, 100),
    [scrollY, setScrollY] = useState(0);

  const yearMap = useMemo(() => {
    const newYearMap = new Map<
      string,
      Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>
    >();

    if (data) {
      for (const [dateKey, itemList] of Object.entries(data)) {
        const year = dateKey.split('-')[0];
        const yearData = newYearMap.get(year);
        if (yearData) {
          yearData[dateKey] = itemList;
        } else {
          newYearMap.set(year, { [dateKey]: itemList });
        }
      }
    }
    return newYearMap;
  }, [data]);

  useScrollToHash();

  const listItems = useMemo(
    () =>
      yearMap ? (
        <>
          {/* new code using yearMap */}
          {[...yearMap.entries()].map(
            ([year, dateMap], yearIndex, yearElements) => (
              <div key={year} className="relative">
                {/* Vertical line */}
                <div className="absolute left-8 top-4 h-[calc(100%-12px)] w-[2px] md:w-1 bg-gray-200 z-0 rounded-full" />
                <TimelineYearHeader
                  key={`${year}${yearIndex}`}
                  year={year}
                  fullDate={Object.entries(dateMap)?.[0]?.[0]}
                />
                {Object.entries(dateMap).map(([dateKey, itemList]) => (
                  <div key={dateKey} className="ml-1">
                    <TimelineMonthDayHeader dateKey={dateKey} />
                    <TimelineItem
                      dateKey={dateKey}
                      itemList={itemList}
                      showIndividualItems={showIndividualItems}
                    />
                  </div>
                ))}
              </div>
            ),
          )}
          {status !== QueryStatus.COMPLETE_HIDE_LOAD_MORE &&
            status !== QueryStatus.LOADING && (
              <LoadMoreButton status={status} loadNextPage={loadNextPage} />
            )}
        </>
      ) : (
        []
      ),
    [yearMap, status, loadNextPage, showIndividualItems],
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
        {!(
          status === QueryStatus.LOADING_MORE || status === QueryStatus.LOADING
        ) && hasNoRecords ? (
          <EmptyRecordsPlaceholder />
        ) : (
          <div className="flex w-full overflow-hidden">
            <JumpToPanel
              items={data}
              isLoading={false}
              status={status}
              loadMore={loadNextPage}
            />
            <div
              className="px-auto flex h-full max-h-full w-full justify-center overflow-y-scroll relative"
              ref={scrollContainer}
              onScroll={onScroll}
            >
              <div className="h-max w-full max-w-4xl flex-col px-4 pb-20 sm:px-6 sm:pb-6 lg:px-8">
                <SearchBar query={query} setQuery={setQuery} status={status} />
                {listItems}
                {(Object.keys(data || {}) || []).length === 0 ? (
                  <main className="grid min-h-full place-items-center bg-white px-6 py-24 sm:py-32 lg:px-8">
                    <div className="text-center">
                      <p className="text-base font-semibold text-primary-600">
                        <MagnifyingGlassIcon className="h-12 w-12 mx-auto" />
                      </p>
                      <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                        No matching records
                      </h1>
                      <p className="mt-6 text-lg leading-7 text-gray-700">{`No records found with query: ${query}`}</p>
                    </div>
                  </main>
                ) : null}
              </div>
              <button
                onClick={scrollToTop}
                className={`z-40 fixed transition-all duration-200 bottom-24 right-4 md:bottom-4 md:right-8 shadow-blue-500/50 bg-primary shadow-md hover:shadow-lg active:shadow-sm rounded-full p-2 active:scale-95 hover:scale-105 ${
                  scrollY > 100 ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <span className="text-white">
                  <ArrowUpIcon className="h-6 w-6" />
                </span>
              </button>
            </div>
          </div>
        )}
      </Transition>
    </AppPage>
  );
}

function LoadMoreButton({
  status,
  loadNextPage,
}: {
  status: QueryStatus;
  loadNextPage: () => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null),
    entry = useIntersectionObserver(ref, {}),
    isVisible = !!entry?.isIntersecting;

  useEffect(() => {
    if (isVisible) {
      loadNextPage();
    }
  }, [isVisible, loadNextPage]);

  return (
    <button
      ref={ref}
      disabled={status === QueryStatus.LOADING_MORE}
      className="border-1 hover:bg-primary-700 mt-6 w-full rounded border border-gray-300 px-4 py-2 font-bold hover:text-white disabled:bg-gray-100 disabled:text-gray-600"
      onClick={loadNextPage}
    >
      {status === QueryStatus.LOADING_MORE
        ? 'Loading more records'
        : 'Load more records'}
      <span className="ml-2 inline-flex justify-center align-middle">
        {status === QueryStatus.LOADING_MORE ? <ButtonLoadingSpinner /> : null}
      </span>
    </button>
  );
}

// scroll to top hook, returns a function that scrolls to the top of the page
function useScrollToTop(ref?: React.RefObject<HTMLDivElement | undefined>) {
  return useCallback(() => {
    ref?.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ref]);
}

const onScrollGetYPosition = (element: HTMLElement) => {
  return element.scrollTop;
};

export const checkIfDefaultDate = (date: string) =>
  differenceInDays(parseISO(date), new Date(0)) < 1;

export const formattedTitleDateMonthString = (dateKey: string) =>
  !dateKey || checkIfDefaultDate(dateKey)
    ? ''
    : format(parseISO(dateKey), 'MMM');

export const formattedTitleDateDayString = (dateKey: string) =>
  !dateKey || checkIfDefaultDate(dateKey)
    ? ''
    : format(parseISO(dateKey), 'dd');

export const PAGE_SIZE = 50;

export async function fetchRecordsWithVectorSearch({
  db,
  vectorStorage,
  query,
  numResults = 10,
  enableSearchAttachments = false,
  groupByDate = true,
}: {
  db: RxDatabase<DatabaseCollections>;
  vectorStorage: VectorStorage<any>;
  query?: string;
  numResults?: number;
  enableSearchAttachments?: boolean;
  groupByDate?: boolean;
}): Promise<{
  records: Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>;
  idsOfMostRelatedChunksFromSemanticSearch: string[];
}> {
  if (!query) {
    return {
      records: {},
      idsOfMostRelatedChunksFromSemanticSearch: [],
    };
  }

  let searchParams: IVSSimilaritySearchParams = {
    query,
    k: numResults,
  };

  if (!enableSearchAttachments) {
    searchParams = {
      ...searchParams,
      filterOptions: {
        exclude: {
          metadata: {
            category: 'documentreference_attachment',
          },
        },
      },
    };
  }

  const results = await vectorStorage.similaritySearch(searchParams);

  // Display the search results
  const ids = results.similarItems.map((item) => {
    return item.id;
  });

  // IDs may have '_chunk148000' appended to them. Remove this
  const cleanedIds = [
    ...new Set(
      ids.map((id) => {
        return id.split('_chunk')[0];
      }),
    ),
  ];

  const docs = await db.clinical_documents
    .find({
      selector: {
        id: { $in: cleanedIds },
        'data_record.resource_type': {
          $nin: ['patient', 'careplan', 'allergyintolerance'],
        },
      },
    })
    .exec();

  const lst = docs as unknown as RxDocument<
    ClinicalDocument<BundleEntry<FhirResource>>
  >[];

  if (!groupByDate) {
    return {
      records: {
        [new Date(0).toISOString()]: lst.map((item) => item.toMutableJSON()),
      },
      idsOfMostRelatedChunksFromSemanticSearch: ids,
    };
  }

  // Group records by date
  const groupedRecords: Record<
    string, // date to group by
    ClinicalDocument<BundleEntry<FhirResource>>[] // documents/cards for date
  > = {};

  lst.forEach((item) => {
    if (item.get('metadata')?.date === undefined) {
      console.warn('Date is undefined for object:');
      console.log(item.toJSON());
      // set date to min date
      const minDate = new Date(0).toISOString();
      if (groupedRecords[minDate]) {
        groupedRecords[minDate].push(
          item.toMutableJSON() as ClinicalDocument<BundleEntry<FhirResource>>,
        );
      } else {
        groupedRecords[minDate] = [item.toMutableJSON()];
      }
    } else {
      const date = item.get('metadata')?.date
        ? format(parseISO(item.get('metadata')?.date), 'yyyy-MM-dd')
        : '-1';
      if (groupedRecords[date]) {
        groupedRecords[date].push(
          item.toMutableJSON() as ClinicalDocument<BundleEntry<FhirResource>>,
        );
      } else {
        groupedRecords[date] = [item.toMutableJSON()];
      }
    }
  });
  try {
    const ordered = Object.keys(groupedRecords)
      .sort((a, b) => {
        const aDate = parseISO(a);
        const bDate = parseISO(b);
        if (aDate > bDate) {
          return -1;
        } else if (aDate < bDate) {
          return 1;
        } else {
          return 0;
        }
      })
      .reduce((obj: any, key) => {
        obj[key] = groupedRecords[key];
        return obj;
      }, {});
    const res = {
      records: ordered,
      idsOfMostRelatedChunksFromSemanticSearch: ids,
    };
    return res;
  } catch (e) {
    console.error(e);
  }

  const res = {
    records: groupedRecords,
    idsOfMostRelatedChunksFromSemanticSearch: ids,
  };
  return res;
}

/**
 * Fetches records from the database and groups them by date
 * @param db
 * @returns
 */
export async function fetchRecords(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
  query?: string,
  page?: number,
): Promise<Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>> {
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
              >,
            );
          } else {
            groupedRecords[date] = [item.toMutableJSON()];
          }
        }
      });

      console.debug('TimelineTab: ', groupedRecords);

      return groupedRecords;
    });

  return gr;
}
