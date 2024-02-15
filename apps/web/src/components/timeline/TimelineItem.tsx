/* eslint-disable react/jsx-no-useless-fragment */
import { differenceInDays, format, parseISO } from 'date-fns';
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
import React, { memo } from 'react';

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
}: {
  dateKey: string;
  itemList: ClinicalDocument<BundleEntry<FhirResource>>[];
  showIndividualItems?: boolean;
}) {
  const checkIfDefaultDate = (date: string) =>
    differenceInDays(parseISO(date), new Date(0)) < 1;
  const formattedTitleDateString =
    !dateKey || checkIfDefaultDate(dateKey)
      ? 'No date'
      : format(parseISO(dateKey), 'MMM dd');
  const formattedCardDateString =
    !dateKey || checkIfDefaultDate(dateKey)
      ? ''
      : format(parseISO(dateKey), 'MMMM do, yyyy');

  return (
    <div
      id={format(parseISO(dateKey), 'MMM-dd-yyyy')}
      className="flex scroll-mt-10 flex-row gap-x-4 px-0 pt-4 md:px-2"
      key={dateKey}
    >
      <div className="flex w-1/5 flex-row md:w-1/4">
        {/* Left sided date */}
        <span className="text-primary-600 flex grow justify-end gap-x-4 whitespace-nowrap pt-5 text-sm font-bold md:text-base">
          <div>{formattedTitleDateString}</div>
          <div className="">•</div>
        </span>
      </div>
      {/* Clinical card rendering */}
      <div className="flex w-4/5 flex-col gap-y-2 md:w-3/4">
        {!showIndividualItems ? (
          <ElementsByDateListCard
            itemList={itemList}
            dateString={formattedCardDateString}
          />
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
                  />
                )}
                {item.data_record.resource_type ===
                  'documentreference_attachment' && (
                  <DocumentReferenceAttachmentCard
                    key={item.id}
                    item={item as unknown as ClinicalDocument<string>}
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
