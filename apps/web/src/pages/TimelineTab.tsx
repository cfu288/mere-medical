import { IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import { format, parseISO } from 'date-fns';
import {
  BundleEntry,
  Condition,
  DiagnosticReport,
  FhirResource,
  Immunization,
  MedicationStatement,
  Observation,
  Procedure,
} from 'fhir/r2';
import { useEffect, useState } from 'react';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import {
  ClinicalDocument,
  MergeClinicalDocument,
} from '../models/ClinicalDocument';
import { ConditionCard } from '../components/ConditionCard';
import { RxDatabase, RxDocument } from 'rxdb';
import { DiagnosticReportCard } from '../components/DiagnosticReportCard';
import { ImmunizationCard } from '../components/ImmunizationCard';
import { ObservationCard } from '../components/ObservationCard';
import { ProcedureCard } from '../components/ProcedureCard';
import { TimelineBanner } from '../components/TimelineBanner';
import { MedicationCard } from '../components/MedicationCard';
import { EmptyRecordsPlaceholder } from '../models/EmptyRecordsPlaceholder';

function fetchRecords(db: RxDatabase<DatabaseCollections>) {
  return db.clinical_documents
    .find({
      selector: {
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

      // Now that we've grouped by date, lets group cards further if a set of cards on a single date belong to the same lab panel
      Object.entries(groupedRecords).forEach(([date, itemList]) => {
        const groupedCards: Record<
          string, // merge_key
          MergeClinicalDocument<BundleEntry<FhirResource>> // documents for date
        > = {};

        // Merge key is used to de-dup cards that should be displayed together, like observations to a diagnostic report
        itemList.forEach((item) => {
          const mergeKey = item.metadata?.merge_key;
          // only attempt to merge if mergeKey exists and is not undefined
          if (mergeKey !== undefined) {
            if (groupedCards[mergeKey]) {
              // Push to existing data_item
              groupedCards[mergeKey].data_items?.push(item.data_record.raw);
            } else {
              // If new key, add as first item and initialize data_items with same item for display later
              groupedCards[mergeKey] = item;
              groupedCards[mergeKey].data_items = [item.data_record.raw];
            }
          }
        });

        // Replace existing array with un-duped array
        groupedRecords[date] = Object.entries(groupedCards).map(
          ([, res]) => res
        );
      });

      return groupedRecords;
    });
}

const TimelineTab: React.FC = () => {
  const db = useRxDb();
  const [list, setList] =
    useState<Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>>();

  useEffect(() => {
    // Fetch clinical documents to display
    fetchRecords(db).then((groupedRecords) => setList(groupedRecords));
  }, [db]);

  return (
    <IonPage>
      <IonHeader>
        <TimelineBanner />
      </IonHeader>
      <IonContent fullscreen>
        <div className="flex flex-col max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {!list ||
            (Object.entries(list).length === 0 && <EmptyRecordsPlaceholder />)}
          {list &&
            Object.entries(list).map(([key, itemList]) => (
              <div className="flex flex-row pt-12 gap-x-4" key={key}>
                <span className="flex justify-end grow font-bold whitespace-nowrap text-primary-700 pt-5">
                  {format(parseISO(key), 'MMM dd')}
                </span>
                <div className="relative flex flex-column justify-center font-black text-primary-700 pt-5">
                  <div className="">⬤</div>
                  {/* <div className="absolute h-full mt-8 border border-gray-300"></div> */}
                </div>
                <div className="flex flex-col gap-y-4 w-3/4">
                  {itemList.map((item) => (
                    <div key={item._id}>
                      {item.data_record.resource_type === 'immunization' && (
                        <ImmunizationCard
                          key={item._id}
                          item={
                            item as ClinicalDocument<BundleEntry<Immunization>>
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
                        'medication_statement' && (
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
                        'diagnostic_report' && (
                        <DiagnosticReportCard
                          key={item._id}
                          item={
                            item as ClinicalDocument<
                              BundleEntry<DiagnosticReport>
                            >
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default TimelineTab;
