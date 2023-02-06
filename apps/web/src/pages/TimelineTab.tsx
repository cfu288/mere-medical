import { format, parseISO } from 'date-fns';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { useEffect, useMemo, useState } from 'react';
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
      const lst = (list as unknown) as RxDocument<
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

export enum QueryStatus {
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
    [list, setList] = useState<
      Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>
    >(),
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

export function TimelineTab() {
  const user = useUser(),
    [query, setQuery] = useState(''),
    [data, status, initialized] = useRecordQuery(query),
    hasNoRecords = query === '' && (!data || Object.entries(data).length === 0),
    hasRecords =
      (data !== undefined && Object.entries(data).length > 0) ||
      (query !== '' && data !== undefined);

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
        className={'relative flex'}
        show={initialized}
        enter="transition-opacity ease-in-out duration-75"
        enterFrom="opacity-75"
        enterTo="opacity-100"
        leave="transition-opacity ease-in-out duration-75"
        leaveFrom="opacity-100"
        leaveTo="opacity-75"
      >
        {hasRecords ? <JumpToPanel items={data} isLoading={false} /> : null}
        {hasNoRecords ? (
          <div className="mx-auto w-full max-w-4xl gap-x-4 px-4 pt-2 pb-4 sm:px-6 lg:px-8">
            <EmptyRecordsPlaceholder />
          </div>
        ) : null}
        {hasRecords ? (
          <div className="relative mx-auto flex w-full max-w-4xl flex-col overflow-x-clip px-4 pb-12 sm:px-6 lg:px-8">
            <SearchBar query={query} setQuery={setQuery} status={status} />
            {listItems}
            {hasNoRecords ? (
              <p className="font-xl">{`No records found with query: ${query}`}</p>
            ) : null}
          </div>
        ) : null}
      </Transition>
    </AppPage>
  );
}
