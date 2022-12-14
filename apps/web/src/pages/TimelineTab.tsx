import { IonContent, IonHeader, IonPage } from '@ionic/react';
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
import { useEffect, useState } from 'react';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import { ClinicalDocument } from '../models/ClinicalDocument';
import { ConditionCard } from '../components/ConditionCard';
import { RxDatabase, RxDocument } from 'rxdb';
import { DiagnosticReportCard } from '../components/Timeline/DiagnosticReportCard';
import { ImmunizationCard } from '../components/Timeline/ImmunizationCard';
import { ObservationCard } from '../components/ObservationCard';
import { ProcedureCard } from '../components/ProcedureCard';
import { TimelineBanner } from '../components/TimelineBanner';
import { MedicationCard } from '../components/MedicationCard';
import { EmptyRecordsPlaceholder } from '../models/EmptyRecordsPlaceholder';
import { useUser } from '../components/UserProvider';
import { DocumentReferenceCard } from '../components/DocumentReferenceCard';
import { useThrottle } from '@react-hook/throttle';

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
  const db = useRxDb();
  const [list, setList] =
    useState<Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>>();
  const user = useUser();
  const [scrollPosition, setScrollPosition] = useThrottle(0);

  useEffect(() => {
    // Fetch clinical documents to display
    fetchRecords(db).then((groupedRecords) => {
      setList(groupedRecords);
      console.debug(groupedRecords);
    });
  }, [db]);

  return (
    <IonPage>
      <IonHeader>
        <TimelineBanner
          text={
            user?.first_name ? `Welcome back ${user.first_name}!` : ' Hello!'
          }
        />
      </IonHeader>
      <IonContent
        fullscreen
        scrollEvents
        onIonScroll={(event) => {
          const position = event.detail.scrollTop;
          setScrollPosition(position);
        }}
      >
        <div className="mx-auto flex max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
          {!list ||
            (Object.entries(list).length === 0 && <EmptyRecordsPlaceholder />)}
          {list &&
            Object.entries(list).map(([key, itemList], index, elements) => (
              <>
                {index === 0 ? (
                  <TimelineYearHeader
                    key={`${key}${index}`}
                    year={key}
                    scroll={scrollPosition}
                  />
                ) : (
                  // Only show year header if the next item is not in the same year
                  elements[index + 1] &&
                  format(parseISO(elements[index + 1][0]), 'yyyy') !==
                    format(parseISO(key), 'yyyy') && (
                    <TimelineYearHeader
                      key={`${key}${index}`}
                      year={key}
                      scroll={scrollPosition}
                    />
                  )
                )}
                <div className="flex flex-row gap-x-4 pt-12" key={key}>
                  <span className="text-primary-700 flex grow justify-end whitespace-nowrap pt-5 font-bold">
                    {format(parseISO(key), 'MMM dd')}
                  </span>
                  <div className="flex-column text-primary-700 relative flex justify-center pt-5 font-black">
                    <div className="">•</div>
                  </div>
                  <div className="flex w-3/4 flex-col gap-y-4">
                    {itemList.map((item) => (
                      <div key={item._id}>
                        {item.data_record.resource_type === 'immunization' && (
                          <ImmunizationCard
                            key={item._id}
                            item={
                              item as ClinicalDocument<
                                BundleEntry<Immunization>
                              >
                            }
                          />
                        )}
                        {item.data_record.resource_type === 'condition' && (
                          <ConditionCard
                            key={item._id}
                            item={
                              item as ClinicalDocument<BundleEntry<Condition>>
                            }
                          />
                        )}
                        {item.data_record.resource_type === 'procedure' && (
                          <ProcedureCard
                            key={item._id}
                            item={
                              item as ClinicalDocument<BundleEntry<Procedure>>
                            }
                          />
                        )}
                        {item.data_record.resource_type === 'observation' && (
                          <ObservationCard
                            key={item._id}
                            item={
                              item as ClinicalDocument<BundleEntry<Observation>>
                            }
                          />
                        )}
                        {item.data_record.resource_type ===
                          'medicationstatement' && (
                          <MedicationCard
                            key={item._id}
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
                            key={item._id}
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
                            key={item._id}
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
              </>
            ))}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default TimelineTab;

function TimelineYearHeader({
  year,
  scroll,
}: {
  year: string;
  scroll: number;
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-col">
      <div className="flex flex-row bg-white pt-4 pb-2">
        <span className="flex grow"></span>
        <div className="w-3/4">
          <p className="text-xl font-black">
            Timeline of {format(parseISO(year), 'yyyy')}
          </p>
        </div>
      </div>
      <div className="bg-gradient-to-b from-red-700"></div>
    </div>
  );
}
