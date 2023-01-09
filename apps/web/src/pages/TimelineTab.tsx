import { format, parseISO } from 'date-fns';
import {
  BundleEntry,
  Condition,
  DiagnosticReport,
  DocumentReference,
  FhirResource,
  Immunization,
  MedicationStatement,
  Observation,
  Procedure,
} from 'fhir/r2';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import {
  DatabaseCollections,
  useRxDb,
} from '../components/providers/RxDbProvider';
import { RxDatabase, RxDocument } from 'rxdb';

import { EmptyRecordsPlaceholder } from '../components/EmptyRecordsPlaceholder';
import { useUser } from '../components/providers/UserProvider';
import { AppPage } from '../components/AppPage';
import { useLocation } from 'react-router-dom';
import { ConditionCard } from '../components/timeline/ConditionCard';
import { DiagnosticReportCard } from '../components/timeline/DiagnosticReportCard';
import { DocumentReferenceCard } from '../components/timeline/DocumentReferenceCard';
import { ImmunizationCard } from '../components/timeline/ImmunizationCard';
import { JumpToPanel } from '../components/timeline/JumpToPanel';
import { MedicationCard } from '../components/timeline/MedicationCard';
import { ObservationCard } from '../components/timeline/ObservationCard';
import { ProcedureCard } from '../components/timeline/ProcedureCard';
import { TimelineBanner } from '../components/timeline/TimelineBanner';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocumentType';

function fetchRecords(db: RxDatabase<DatabaseCollections>) {
  return db.clinical_documents
    .find({
      selector: {
        'data_record.resource_type': {
          $nin: ['patient', 'observation'],
        },
        'metadata.date': { $gt: 0 },
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
        }
        const date = item.get('metadata')?.date
          ? format(parseISO(item.get('metadata')?.date), 'yyyy-MM-dd')
          : '-1';
        if (groupedRecords[date]) {
          groupedRecords[date].push(
            item.toMutableJSON() as ClinicalDocument<BundleEntry<FhirResource>>
          );
        } else {
          groupedRecords[date] = [item.toMutableJSON()];
        }
      });

      return groupedRecords;
    });
}

const TimelineTab: React.FC = () => {
  const db = useRxDb(),
    [list, setList] =
      useState<Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>>(),
    user = useUser(),
    { pathname, hash, key } = useLocation();

  useEffect(() => {
    // Fetch clinical documents to display
    fetchRecords(db).then((groupedRecords) => {
      setList(groupedRecords);
      console.debug(groupedRecords);
    });
  }, [db]);

  useEffect(() => {
    // if not a hash link, scroll to top
    if (hash === '') {
      // window.scrollTo(0, 0);
    }
    // else scroll to id
    else {
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
    }
  }, [pathname, hash, key]); // do this on route change

  return (
    <AppPage
      banner={
        <TimelineBanner
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
            {list &&
              Object.entries(list).map(([key, itemList], index, elements) => (
                <Fragment key={key}>
                  {index === 0 ? (
                    <TimelineYearHeader key={`${key}${index}`} year={key} />
                  ) : null}
                  <div
                    id={format(parseISO(key), 'MMM-dd-yyyy')}
                    className="flex scroll-mt-10 flex-row gap-x-4 px-2 pt-8"
                    key={key}
                  >
                    <span className="text-primary-700 flex grow justify-end whitespace-nowrap pt-5 font-bold">
                      {format(parseISO(key), 'MMM dd')}
                    </span>
                    <div className="flex-column text-primary-700 relative flex justify-center pt-5 font-black">
                      <div className="">•</div>
                    </div>
                    <div className="flex w-3/4 flex-col gap-y-2">
                      {itemList.map((item) => (
                        <div key={item.id}>
                          {item.data_record.resource_type ===
                            'immunization' && (
                            <ImmunizationCard
                              key={item.id}
                              item={
                                item as ClinicalDocument<
                                  BundleEntry<Immunization>
                                >
                              }
                            />
                          )}
                          {item.data_record.resource_type === 'condition' && (
                            <ConditionCard
                              key={item.id}
                              item={
                                item as ClinicalDocument<BundleEntry<Condition>>
                              }
                            />
                          )}
                          {item.data_record.resource_type === 'procedure' && (
                            <ProcedureCard
                              key={item.id}
                              item={
                                item as ClinicalDocument<BundleEntry<Procedure>>
                              }
                            />
                          )}
                          {item.data_record.resource_type === 'observation' && (
                            <ObservationCard
                              key={item.id}
                              item={
                                item as ClinicalDocument<
                                  BundleEntry<Observation>
                                >
                              }
                            />
                          )}
                          {item.data_record.resource_type ===
                            'medicationstatement' && (
                            <MedicationCard
                              key={item.id}
                              item={
                                item as ClinicalDocument<
                                  BundleEntry<MedicationStatement>
                                >
                              }
                            />
                          )}
                          {item.data_record.resource_type ===
                            'diagnosticreport' && (
                            <DiagnosticReportCard
                              key={item.id}
                              item={
                                item as ClinicalDocument<
                                  BundleEntry<DiagnosticReport>
                                >
                              }
                            />
                          )}
                          {item.data_record.resource_type ===
                            'documentreference' && (
                            <DocumentReferenceCard
                              key={item.id}
                              item={
                                item as ClinicalDocument<
                                  BundleEntry<DocumentReference>
                                >
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {
                    // Only show year header if the next item is not in the same year
                    elements[index + 1] &&
                      format(parseISO(elements[index + 1][0]), 'yyyy') !==
                        format(parseISO(key), 'yyyy') && (
                        <>
                          <div className="h-12" />
                          <TimelineYearHeader
                            key={`${key}${index}`}
                            year={format(
                              parseISO(elements[index + 1][0]),
                              'yyyy'
                            )}
                          />
                        </>
                      )
                  }
                </Fragment>
              ))}
          </div>
        )}
      </div>
    </AppPage>
  );
};

export default TimelineTab;

function TimelineYearHeader({ year }: { year: string }) {
  return (
    <div className="sticky top-0 left-0 z-10 flex flex-col bg-white">
      <div className="relative flex flex-row pt-4 pb-1">
        <div className="absolute -top-4 h-4 w-full bg-gradient-to-t from-white"></div>
        <span className="flex grow"></span>
        <div className="w-full">
          <p className="text-xl font-black">{`Timeline of ${format(
            parseISO(year),
            'yyyy'
          )}`}</p>
        </div>
        <div className="absolute -bottom-4 h-4 w-full bg-gradient-to-b from-white"></div>
      </div>
    </div>
  );
}
