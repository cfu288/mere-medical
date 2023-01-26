import { format, parseISO } from 'date-fns';
import { BundleEntry, FhirResource } from 'fhir/r2';
import React, { useEffect, useState } from 'react';
import {
  DatabaseCollections,
  useRxDb,
} from '../components/providers/RxDbProvider';
import { RxDatabase, RxDocument } from 'rxdb';
import { EmptyRecordsPlaceholder } from '../components/EmptyRecordsPlaceholder';
import { useUser } from '../components/providers/UserProvider';
import { AppPage } from '../components/AppPage';
import { useLocation } from 'react-router-dom';
import { JumpToPanel } from '../components/timeline/JumpToPanel';
import { TimelineBanner } from '../components/timeline/TimelineBanner';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import { TimelineItem } from '../components/timeline/TimelineItem';
import { TimelineYearHeaderWrapper } from '../components/timeline/TimelineYearHeaderWrapper';

/**
 * This should really be a background process that runs after every data sync instead of every view
 * @param db
 * @returns
 */
function fetchRecords(db: RxDatabase<DatabaseCollections>, user_id: string) {
  return db.clinical_documents
    .find({
      selector: {
        user_id: user_id,
        'data_record.resource_type': {
          $nin: ['patient', 'observation'],
        },
        'metadata.date': { $nin: [null, undefined, ''] },
      },
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

function TimelineTab() {
  const db = useRxDb(),
    [list, setList] =
      useState<Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>>(),
    user = useUser();

  useScrollToHash();

  useEffect(() => {
    // Fetch clinical documents to display
    fetchRecords(db, user.id).then((groupedRecords) => {
      setList(groupedRecords);
      console.debug(groupedRecords);
    });
  }, [db, user.id]);

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
      <div className="relative flex">
        {list && Object.entries(list).length !== 0 ? (
          <JumpToPanel list={list} />
        ) : null}
        {!list || Object.entries(list).length === 0 ? (
          <div className="mx-auto w-full max-w-4xl gap-x-4 px-4 pt-2 pb-4 sm:px-6 lg:px-8">
            <EmptyRecordsPlaceholder />
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col overflow-x-clip px-4 pb-12 sm:px-6 md:pt-6 lg:px-8">
            {Object.entries(list).map(
              ([dateKey, itemList], index, elements) => (
                <TimelineYearHeaderWrapper
                  key={dateKey}
                  dateKey={dateKey}
                  index={index}
                  elements={elements}
                >
                  <TimelineItem dateKey={dateKey} itemList={itemList} />
                </TimelineYearHeaderWrapper>
              )
            )}
          </div>
        )}
      </div>
    </AppPage>
  );
}

export default TimelineTab;
