import { IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import { format, parseISO } from 'date-fns';
import {
  BundleEntry,
  Condition,
  DiagnosticReport,
  FhirResource,
  Immunization,
  Observation,
  Procedure,
} from 'fhir/r2';
import { useEffect, useState } from 'react';
import { usePouchDb } from '../components/PouchDbProvider';
import {
  ClinicalDocument,
  MergeClinicalDocument,
} from '../models/ClinicalDocument';
import { ConditionCard } from './ConditionCard';
import { DiagnosticReportCard } from './DiagnosticReportCard';
import { ImmunizationCard } from './ImmunizationCard';
import { ObservationCard } from './ObservationCard';
import { ProcedureCard } from './ProcedureCard';
import { TimelineBanner } from './TimelineBanner';

const TimelineTab: React.FC = () => {
  const db = usePouchDb();
  const [list, setList] =
    useState<Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>>();

  useEffect(() => {
    // Fetch clinical documents to display
    db.find({
      selector: {
        $and: [{ type: 'clinical' }, { 'metadata.date': { $gt: 0 } }],
      },
      sort: [{ 'metadata.date': 'desc' }],
    }).then((list) => {
      const lst = list as PouchDB.Find.FindResponse<
        ClinicalDocument<BundleEntry<FhirResource>>
      >;

      // Group records by date
      const groupedRecords: Record<
        string, // date to group by
        ClinicalDocument<BundleEntry<FhirResource>>[] // documents/cards for date
      > = {};

      lst.docs.forEach((item) => {
        const date = item.metadata?.date
          ? format(parseISO(item.metadata.date), 'yyyy-MM-dd')
          : '-1';
        if (groupedRecords[date]) {
          groupedRecords[date].push(item);
        } else {
          groupedRecords[date] = [item];
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

      setList(groupedRecords);
    });
  }, [db]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <TimelineBanner />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="flex flex-col px-4">
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
                          item={
                            item as PouchDB.Core.ExistingDocument<
                              ClinicalDocument<BundleEntry<Immunization>>
                            >
                          }
                        />
                      )}
                      {item.data_record.resource_type === 'condition' && (
                        <ConditionCard
                          item={
                            item as PouchDB.Core.ExistingDocument<
                              ClinicalDocument<BundleEntry<Condition>>
                            >
                          }
                        />
                      )}
                      {item.data_record.resource_type === 'procedure' && (
                        <ProcedureCard
                          item={
                            item as PouchDB.Core.ExistingDocument<
                              ClinicalDocument<BundleEntry<Procedure>>
                            >
                          }
                        />
                      )}
                      {item.data_record.resource_type === 'observation' && (
                        <ObservationCard
                          item={
                            item as PouchDB.Core.ExistingDocument<
                              ClinicalDocument<BundleEntry<Observation>>
                            >
                          }
                        />
                      )}
                      {item.data_record.resource_type ===
                        'diagnostic_report' && (
                        <DiagnosticReportCard
                          item={
                            item as PouchDB.Core.ExistingDocument<
                              ClinicalDocument<BundleEntry<DiagnosticReport>>
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
