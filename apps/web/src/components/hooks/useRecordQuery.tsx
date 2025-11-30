import { BundleEntry, FhirResource } from 'fhir/r2';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounceCallback } from '@react-hook/debounce';
import { useLocalConfig } from '../providers/LocalConfigProvider';
import { useRxDb } from '../providers/RxDbProvider';
import { useUser } from '../providers/UserProvider';
import { useVectors } from '../providers/vector-provider';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import {
  QueryStatus,
  fetchRecords,
  fetchRecordsWithVectorSearch,
  PAGE_SIZE,
} from '../../pages/TimelineTab';

/**
 * Fetches records from the database and groups them by date
 * @param query Query to execute
 * @param enableAISemanticSearch Enable vector based semantic search
 * @returns
 */
export function useRecordQuery(
  query: string,
  enableAISemanticSearch?: boolean,
): {
  data:
    | Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>
    | undefined; // Data returned by query, grouped records by date
  status: QueryStatus;
  initialized: boolean; // Indicates whether the query has run at least once
  loadNextPage: () => void; // Function to load next page of results
  showIndividualItems: boolean; // Indicates whether to show individual items or group by date
} {
  const db = useRxDb(),
    { experimental__use_openai_rag } = useLocalConfig(),
    user = useUser(),
    hasRun = useRef(false),
    [status, setQueryStatus] = useState(QueryStatus.IDLE),
    [initialized, setInitialized] = useState(false),
    [data, setList] =
      useState<Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>>(),
    [currentPage, setCurrentPage] = useState(0),
    [showIndividualItems, setShowIndividualItems] = useState(false),
    vectorStorage = useVectors(),
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
              if (enableAISemanticSearch) {
                if (Object.keys(groupedRecords).length === 0) {
                  setQueryStatus(QueryStatus.LOADING);
                  // If no results, try AI search
                  isAiSearch = true;
                  groupedRecords = (
                    await fetchRecordsWithVectorSearch({
                      db,
                      vectorStorage,
                      query,
                      userId: user.id,
                      numResults: 20,
                      enableSearchAttachments: true,
                      groupByDate: true,
                    })
                  ).records;
                  setQueryStatus(QueryStatus.COMPLETE_HIDE_LOAD_MORE);
                }
              }
            }
          }

          // If load more, increment page. Otherwise, reset page to 0
          if (loadMore) {
            console.debug('TimelineTab: load next page: ', currentPage + 1);
            setCurrentPage(currentPage + 1);
          } else {
            setCurrentPage(0);
            console.debug('TimelineTab: reset page to 0');
          }

          // Merge results with existing results or overwrite existing results
          if (loadMore) {
            const merged = { ...data };
            for (const [dateKey, records] of Object.entries(groupedRecords)) {
              if (merged[dateKey]) {
                merged[dateKey] = [...merged[dateKey], ...records];
              } else {
                merged[dateKey] = records;
              }
            }
            setList(merged);
          } else {
            setList(groupedRecords);
          }
          console.debug(groupedRecords);

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
          if (query) {
            setShowIndividualItems(true);
          } else {
            setShowIndividualItems(false);
          }
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
        enableAISemanticSearch,
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
      'TimelineTab: query changed or AI toggled: ',
      query,
      enableAISemanticSearch,
    );
    setQueryStatus(QueryStatus.LOADING);
    debounceExecQuery();
  }, [query, debounceExecQuery, enableAISemanticSearch]);

  return { data, status, initialized, loadNextPage, showIndividualItems };
}
