/* eslint-disable react/jsx-no-useless-fragment */
import { format, parseISO } from 'date-fns';
import {
  BundleEntry,
  Condition,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FhirResource,
  Immunization,
  MedicationStatement,
  Observation,
  Procedure,
} from 'fhir/r2';
import { memo } from 'react';

import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { ConditionCard } from './ConditionCard';
import { DiagnosticReportCard } from './DiagnosticReportCard';
import {
  DocumentReferenceAttachmentCard,
  DocumentReferenceCard,
} from './DocumentReferenceCard';
import { ElementsByDateListCard } from './ElementsByDateListCard';
import { EncounterCard } from './EncounterCard';
import { ImmunizationCard } from './ImmunizationCard';
import { MedicationCard } from './MedicationCard';
import { ObservationCard } from './ObservationCard';
import { ProcedureCard } from './ProcedureCard';

export const TimelineItem = memo(function TimelineItem({
  dateKey,
  itemList,
  showIndividualItems = false,
  searchQuery,
}: {
  dateKey: string;
  itemList: ClinicalDocument<BundleEntry<FhirResource>>[];
  showIndividualItems?: boolean;
  searchQuery?: string;
}) {
  return (
    <div
      id={format(parseISO(dateKey), 'MMM-dd-yyyy')}
      className="-mt-16 flex scroll-mt-10 flex-row gap-x-4 px-0 pt-4 md:px-2"
      key={dateKey}
    >
      <div className="flex w-1/6 flex-row">{/* Left sided date spacer */}</div>
      {/* Clinical card rendering */}

      <div className="flex w-5/6 flex-col gap-y-2">
        {!showIndividualItems ? (
          <ElementsByDateListCard itemList={itemList} />
        ) : (
          <>
            {itemList.map((item) => (
              <div key={item.id}>
                {item.data_record.resource_type === 'immunization' && (
                  <ImmunizationCard
                    key={item.id}
                    item={item as ClinicalDocument<BundleEntry<Immunization>>}
                  />
                )}
                {item.data_record.resource_type === 'condition' && (
                  <ConditionCard
                    key={item.id}
                    item={item as ClinicalDocument<BundleEntry<Condition>>}
                  />
                )}
                {item.data_record.resource_type === 'procedure' && (
                  <ProcedureCard
                    key={item.id}
                    item={item as ClinicalDocument<BundleEntry<Procedure>>}
                  />
                )}
                {item.data_record.resource_type === 'observation' && (
                  <ObservationCard
                    key={item.id}
                    item={item as ClinicalDocument<BundleEntry<Observation>>}
                  />
                )}
                {item.data_record.resource_type === 'medicationstatement' && (
                  <MedicationCard
                    key={item.id}
                    item={
                      item as ClinicalDocument<BundleEntry<MedicationStatement>>
                    }
                  />
                )}
                {item.data_record.resource_type === 'diagnosticreport' && (
                  <DiagnosticReportCard
                    key={item.id}
                    item={
                      item as ClinicalDocument<BundleEntry<DiagnosticReport>>
                    }
                  />
                )}
                {item.data_record.resource_type === 'documentreference' && (
                  <DocumentReferenceCard
                    key={item.id}
                    item={
                      item as ClinicalDocument<BundleEntry<DocumentReference>>
                    }
                    matchedChunks={(item as any).matchedChunks}
                    searchQuery={searchQuery}
                  />
                )}
                {item.data_record.resource_type ===
                  'documentreference_attachment' && (
                  <DocumentReferenceAttachmentCard
                    key={item.id}
                    item={item as unknown as ClinicalDocument<string>}
                    matchedChunks={(item as any).matchedChunks}
                    searchQuery={searchQuery}
                  />
                )}
                {item.data_record.resource_type === 'encounter' && (
                  <EncounterCard
                    key={item.id}
                    item={item as ClinicalDocument<BundleEntry<Encounter>>}
                  />
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
});
