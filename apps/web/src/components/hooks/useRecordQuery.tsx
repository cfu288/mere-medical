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
  fetchRecordsUntilCompleteDays,
  mergeRecordsByDate,
  PAGE_SIZE,
} from '../../pages/TimelineTab';

type RecordsByDate = Record<
  string,
  ClinicalDocument<BundleEntry<FhirResource>>[]
>;

export function useRecordQuery(
  query: string,
  enableAISemanticSearch?: boolean,
  minCompleteDays: number = 3,
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

  const [status, setQueryStatus] = useState(QueryStatus.IDLE);
  const [initialized, setInitialized] = useState(false);
  const [data, setData] = useState<RecordsByDate>();
  const [currentPage, setCurrentPage] = useState(0);
  const [groupedOffset, setGroupedOffset] = useState(0);

  const showIndividualItems = !!query;

  const execQuery = useCallback(
    async ({ loadMore = false }: { loadMore?: boolean }) => {
      setQueryStatus(loadMore ? QueryStatus.LOADING_MORE : QueryStatus.LOADING);

      try {
        if (!query) {
          const offset = loadMore ? groupedOffset : 0;
          console.debug(
            'useRecordQuery: grouped view, offset:',
            offset,
            'loadMore:',
            loadMore,
          );

          const result = await fetchRecordsUntilCompleteDays(
            db,
            user.id,
            minCompleteDays,
            offset,
          );

          console.debug('useRecordQuery: grouped result', {
            days: Object.keys(result.records).length,
            hasMore: result.hasMore,
            lastOffset: result.lastOffset,
          });

          setData((prev) =>
            loadMore
              ? mergeRecordsByDate(prev, result.records)
              : result.records,
          );
          setGroupedOffset(result.lastOffset);
          setQueryStatus(
            result.hasMore
              ? QueryStatus.SUCCESS
              : QueryStatus.COMPLETE_HIDE_LOAD_MORE,
          );
        } else {
          const page = loadMore ? currentPage + 1 : 0;
          let groupedRecords = await fetchRecords(db, user.id, query, page);

          if (
            vectorStorage &&
            experimental__use_openai_rag &&
            enableAISemanticSearch &&
            Object.keys(groupedRecords).length === 0
          ) {
            setQueryStatus(QueryStatus.LOADING);
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
            setData(groupedRecords);
            setQueryStatus(QueryStatus.COMPLETE_HIDE_LOAD_MORE);
            setInitialized(true);
            return;
          }

          if (loadMore) {
            console.debug('useRecordQuery: load next page:', page);
            setCurrentPage(page);
            setData((prev) => mergeRecordsByDate(prev, groupedRecords));
          } else {
            console.debug('useRecordQuery: reset page to 0');
            setCurrentPage(0);
            setData(groupedRecords);
          }

          console.debug('useRecordQuery: groupedRecords', groupedRecords);

          const recordCount = Object.values(groupedRecords).reduce(
            (a, b) => a + b.length,
            0,
          );
          setQueryStatus(
            recordCount < PAGE_SIZE
              ? QueryStatus.COMPLETE_HIDE_LOAD_MORE
              : QueryStatus.SUCCESS,
          );
        }

        setInitialized(true);
      } catch (e) {
        console.error(e);
        setQueryStatus(QueryStatus.ERROR);
      }
    },
    [
      db,
      user.id,
      query,
      currentPage,
      groupedOffset,
      minCompleteDays,
      vectorStorage,
      experimental__use_openai_rag,
      enableAISemanticSearch,
    ],
  );

  const execQueryRef = useRef(execQuery);
  execQueryRef.current = execQuery;

  const loadNextPage = useDebounceCallback(
    () => execQueryRef.current({ loadMore: true }),
    300,
  );

  useEffect(() => {
    setQueryStatus(QueryStatus.LOADING);
    setGroupedOffset(0);
    setCurrentPage(0);
    execQueryRef.current({ loadMore: false });
  }, [query, enableAISemanticSearch]);

  return { data, status, initialized, loadNextPage, showIndividualItems };
}
