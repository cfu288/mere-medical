import { format, parseISO } from 'date-fns';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MangoQuerySelector, RxDatabase, RxDocument } from 'rxdb';

import { Transition } from '@headlessui/react';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { VectorStorage } from '@mere/vector-storage';
import { useDebounceCallback } from '@react-hook/debounce';

import { AppPage } from '../components/AppPage';
import { ButtonLoadingSpinner } from '../components/connection/ButtonLoadingSpinner';
import { EmptyRecordsPlaceholder } from '../components/EmptyRecordsPlaceholder';
import useIntersectionObserver from '../components/hooks/useIntersectionObserver';
import { useScrollToHash } from '../components/hooks/useScrollToHash';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { useRxDb } from '../components/providers/RxDbProvider';
import { useUser } from '../components/providers/UserProvider';
import {
  prepareClinicalDocumentForVectorization,
  useVectorStorage,
} from '../components/providers/VectorStorageProvider';
import { JumpToPanel } from '../components/timeline/JumpToPanel';
import { TimelineBanner } from '../components/timeline/TimelineBanner';
import { TimelineItem } from '../components/timeline/TimelineItem';
import { TimelineYearHeaderWrapper } from '../components/timeline/TimelineYearHeaderWrapper';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import { SearchBar } from './SearchBar';
import { TimelineSkeleton } from './TimelineSkeleton';
import { useLocalConfig } from '../components/providers/LocalConfigProvider';
import { useNotificationDispatch } from '../components/providers/NotificationProvider';
import React from 'react';
import { getRelatedLoincLabs } from '../components/timeline/ObservationResultRow';

const PAGE_SIZE = 50;

export async function fetchRecordsWithVectorSearch(
  db: RxDatabase<DatabaseCollections>,
  vectorStorage: VectorStorage<any>,
  query?: string,
  numResults = 10,
) {
  if (!query) {
    return {};
  }

  const results = await vectorStorage.similaritySearch({
    query,
    k: numResults,
  });

  // Display the search results
  const ids = results.similarItems.map((item) => {
    return item.metadata.id;
  });

  const docs = await db.clinical_documents
    .find({
      selector: {
        id: { $in: ids },
      },
    })
    .exec();

  const lst = docs as unknown as RxDocument<
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
          item.toMutableJSON() as ClinicalDocument<BundleEntry<FhirResource>>,
        );
      } else {
        groupedRecords[date] = [item.toMutableJSON()];
      }
    }
  });
  // sort map object by keys which are dates
  // dates are in YYYY-MM-DD format
  // use date-fns to parse and compare dates

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

  return ordered as Promise<
    Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>
  >;
}

/**
 * This should really be a background process that runs after every data sync instead of every view
 * @param db
 * @returns
 */
async function fetchRecords(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
  query?: string,
  page?: number,
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
              >,
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
  LOADING, // Initial load and queries with page === 0
  LOADING_MORE, // Currently loading more results using loadNextPage
  SUCCESS,
  ERROR,
  COMPLETE_HIDE_LOAD_MORE, // Indicates that there are no more results to load using loadNextPage
}

function useRecordQuery(
  query: string,
  enableAIQuestionAnswering?: boolean,
): {
  data:
    | Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>
    | undefined; // Data returned by query, grouped records by date
  status: QueryStatus;
  initialized: boolean; // Indicates whether the query has run at least once
  loadNextPage: () => void; // Function to load next page of results
} {
  const db = useRxDb(),
    { experimental__use_openai_rag } = useLocalConfig(),
    user = useUser(),
    hasRun = useRef(false),
    notifyDispatch = useNotificationDispatch(),
    [status, setQueryStatus] = useState(QueryStatus.IDLE),
    [initialized, setInitialized] = useState(false),
    [data, setList] =
      useState<Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>>(),
    [currentPage, setCurrentPage] = useState(0),
    vectorStorage = useVectorStorage(),
    execQuery = useCallback(
      /**
       *
       * @param merge Merge results with existing results. If false, results overwrite existing results
       * @param loadMore Indicate whether this is an inital load or a load more query. Affects visual loading state
       */
      async ({ loadMore = false }: { loadMore?: boolean }) => {
        setQueryStatus(QueryStatus.COMPLETE_HIDE_LOAD_MORE);

        try {
          let isAiSearch = false;
          if (loadMore) {
            setQueryStatus(QueryStatus.LOADING_MORE);
          }

          // Execute query
          let groupedRecords = await fetchRecords(
            db,
            user.id,
            query,
            loadMore ? currentPage + 1 : currentPage,
          );

          if (vectorStorage) {
            if (experimental__use_openai_rag) {
              if (enableAIQuestionAnswering) {
                if (Object.keys(groupedRecords).length === 0) {
                  setQueryStatus(QueryStatus.LOADING);
                  // If no results, try AI search
                  isAiSearch = true;
                  groupedRecords = await fetchRecordsWithVectorSearch(
                    db,
                    vectorStorage,
                    query,
                  );
                  setQueryStatus(QueryStatus.COMPLETE_HIDE_LOAD_MORE);
                }
              }
            }
          }

          // If load more, increment page. Otherwise, reset page to 0
          if (loadMore) {
            console.debug('load next page: ', currentPage + 1);
            setCurrentPage(currentPage + 1);
          } else {
            setCurrentPage(0);
            console.debug('reset page to 0');
          }

          // Merge results with existing results or overwrite existing results
          if (loadMore) {
            setList({ ...data, ...groupedRecords });
          } else {
            setList(groupedRecords);
          }

          // Set query status.
          // Complete indicates that there are no more results to load
          // Success indicates that there are more results to load
          if (
            Object.values(groupedRecords).reduce((a, b) => a + b.length, 0) <
            PAGE_SIZE
          ) {
            setQueryStatus(QueryStatus.COMPLETE_HIDE_LOAD_MORE);
          } else {
            setQueryStatus(QueryStatus.SUCCESS);
          }

          if (isAiSearch) {
            // disable paging for AI search
            setQueryStatus(QueryStatus.COMPLETE_HIDE_LOAD_MORE);
          }

          setInitialized(true);
        } catch (e) {
          console.error(e);
          setQueryStatus(QueryStatus.ERROR);
        }
      },
      [
        vectorStorage,
        db,
        user.id,
        query,
        currentPage,
        experimental__use_openai_rag,
        enableAIQuestionAnswering,
        data,
      ],
    ),
    debounceExecQuery = useDebounceCallback(
      () => execQuery({ loadMore: false }),
      experimental__use_openai_rag ? 1000 : 300,
    ),
    loadNextPage = useDebounceCallback(
      () => execQuery({ loadMore: true }),
      300,
    );

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      setQueryStatus(QueryStatus.LOADING);
      execQuery({
        loadMore: false,
      });
    }
  }, [execQuery, query]);

  useEffect(() => {
    console.debug(
      'query changed or AI toggled: ',
      query,
      enableAIQuestionAnswering,
    );
    setQueryStatus(QueryStatus.LOADING);
    debounceExecQuery();
  }, [query, debounceExecQuery, enableAIQuestionAnswering]);

  return { data, status, initialized, loadNextPage };
}

export function TimelineTab() {
  const user = useUser(),
    db = useRxDb(),
    [query, setQuery] = useState(''),
    { experimental__openai_api_key, experimental__use_openai_rag } =
      useLocalConfig(),
    { data, status, initialized, loadNextPage } = useRecordQuery(
      query,
      experimental__use_openai_rag,
    ),
    hasNoRecords = query === '' && (!data || Object.entries(data).length === 0),
    [aiResponseText, setAiResponseText] = useState(''),
    askAI = useCallback(async () => {
      setAiResponseText('');
      if (data) {
        //prepare data as plattened list
        const dataAsList: Set<string> = new Set();

        for (const [_, itemList] of Object.entries(data)) {
          for (const item of itemList) {
            const minilist =
              prepareClinicalDocumentForVectorization(item).docList;
            const texts = [...minilist.map((i) => i.text)];
            for (const t of texts) {
              dataAsList.add(t);
            }
            // get related documents if item is a diagnostic report or observation
            if (
              item.data_record.raw.resource?.resourceType ===
                'DiagnosticReport' ||
              item.data_record.raw.resource?.resourceType === 'Observation'
            ) {
              const loinc = item.metadata?.loinc_coding || [];
              const relatedDocs = await getRelatedLoincLabs({
                loinc,
                db,
                user,
                limit: 5,
              });
              const relatedList = relatedDocs.flatMap(
                (i) => prepareClinicalDocumentForVectorization(i).docList,
              );
              const relatedTexts = relatedList.map((i) => i.text);
              for (const rt of relatedTexts) {
                dataAsList.add(rt);
              }
            }
          }
          if (dataAsList.size > 100) {
            break;
          }
        }

        const response = await fetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${experimental__openai_api_key}`,
            },
            body: JSON.stringify({
              model: 'gpt-4-1106-preview',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a medical AI assistant. You will be given some data about a patient and a question. Please answer the question using the data provided and address the patient directly.',
                },
                {
                  role: 'system',
                  content: `Here is some information about your patient. Ignore any information that is not relevant to the question: 
  Today's Date: ${new Date().toISOString()};
  ${user?.first_name && user?.last_name ? 'Name: ' + (user?.first_name + ' ' + user?.last_name) : ''}
  ${user?.birthday ? 'DOB: ' + user?.birthday : ''}
  ${user.gender ? 'Gender:' + user?.gender : ''}
  Data: ${JSON.stringify([...dataAsList])}`,
                },
                {
                  role: 'user',
                  content: `The question is: ${query}`,
                },
              ],
              stream: true,
            }),
          },
        );
        const reader = response.body!.getReader();
        const decoder = new TextDecoder('utf-8');

        // Read the response as a stream of data
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            const parsedLines = lines

              .map((line) => line.replace(/^data: /, '').trim()) // Remove the "data: " prefix
              .filter((line) => line !== '' && line !== '[DONE]') // Remove empty lines and "[DONE]"
              .map((line: string) => JSON.parse(line));
            for (const parsedLine of parsedLines) {
              const { choices } = parsedLine;
              const { delta } = choices[0];
              const { content } = delta;

              if (content) {
                setAiResponseText((c) => c + content);
              }
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          reader.releaseLock();
        }
      } else {
        console.error('Data is undefined');
        alert('Data is undefined');
      }
    }, [data, db, experimental__openai_api_key, query, user]);

  useEffect(() => {
    // on query change, clear AI response
    setAiResponseText('');
  }, [query]);

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
          {status !== QueryStatus.COMPLETE_HIDE_LOAD_MORE &&
            status !== QueryStatus.LOADING && (
              <LoadMoreButton status={status} loadNextPage={loadNextPage} />
            )}
        </>
      ) : (
        []
      ),
    [data, loadNextPage, status],
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
            <div className="px-auto flex h-full max-h-full w-full justify-center overflow-y-scroll">
              <div className="h-max w-full max-w-4xl flex-col px-4 pb-20 sm:px-6 sm:pb-6 lg:px-8">
                <SearchBar
                  query={query}
                  setQuery={setQuery}
                  status={status}
                  aiResponse={aiResponseText}
                  askAI={askAI}
                />
                {listItems}
                {(Object.keys(data || {}) || []).length === 0 ? (
                  <p className="font-xl">{`No records found with query: ${query}`}</p>
                ) : null}
              </div>
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
