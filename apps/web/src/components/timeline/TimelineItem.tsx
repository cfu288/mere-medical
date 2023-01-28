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
import React from 'react';
import { ConditionCard } from './ConditionCard';
import { DiagnosticReportCard } from './DiagnosticReportCard';
import { DocumentReferenceCard } from './DocumentReferenceCard';
import { ImmunizationCard } from './ImmunizationCard';
import { MedicationCard } from './MedicationCard';
import { ObservationCard } from './ObservationCard';
import { ProcedureCard } from './ProcedureCard';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';

export function TimelineItem({
  dateKey,
  itemList,
}: {
  dateKey: string;
  itemList: ClinicalDocument<BundleEntry<FhirResource>>[];
}) {
  return (
    <div
      id={format(parseISO(dateKey), 'MMM-dd-yyyy')}
      className="flex scroll-mt-10 flex-row gap-x-4 px-0 pt-8 md:px-2"
      key={dateKey}
    >
      {/* Left sided date */}
      <span className="text-primary-700 flex grow justify-end whitespace-nowrap pt-5 text-sm font-bold md:text-base">
        {format(parseISO(dateKey), 'MMM dd')}
      </span>
      {/* Spacer between date and card */}
      <div className="flex-column  text-primary-700 relative flex justify-center pt-5 font-black">
        <div className="">•</div>
      </div>
      {/* Clinical card rendering */}
      <div className="flex w-4/5 flex-col gap-y-2 md:w-3/4">
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
                item={item as ClinicalDocument<BundleEntry<DiagnosticReport>>}
              />
            )}
            {item.data_record.resource_type === 'documentreference' && (
              <DocumentReferenceCard
                key={item.id}
                item={item as ClinicalDocument<BundleEntry<DocumentReference>>}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
