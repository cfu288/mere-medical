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
import React, { memo, useMemo } from 'react';
import { ConditionCard } from './ConditionCard';
import { DiagnosticReportCard } from './DiagnosticReportCard';
import { DocumentReferenceCard } from './DocumentReferenceCard';
import { ImmunizationCard } from './ImmunizationCard';
import { MedicationCard } from './MedicationCard';
import { ObservationCard } from './ObservationCard';
import { ProcedureCard } from './ProcedureCard';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { EncounterCard } from './EncounterCard';
import { DocumentReferenceAttachmentCard } from './DocumentReferenceCard';
import { CardBase } from '../connection/CardBase';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { TimelineCardTitle } from './TimelineCardTitle';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { Transition } from '@headlessui/react';

export const ElementsByDateListCard = memo(function ElementsByDateListCard({
  itemList,
  dateString,
}: {
  itemList: ClinicalDocument<BundleEntry<FhirResource>>[];
  dateString?: string;
}) {
  const immunizations = useMemo(
    () =>
      itemList
        .filter((item) => item.data_record.resource_type === 'immunization')
        .sort((a, b) => {
          if (a.metadata?.display_name && b.metadata?.display_name) {
            return a.metadata.display_name.localeCompare(
              b.metadata.display_name,
            );
          }
          return 0;
        }),
    [itemList],
  );

  const conditions = useMemo(
    () =>
      itemList
        .filter((item) => item.data_record.resource_type === 'condition')
        .sort((a, b) => {
          if (a.metadata?.display_name && b.metadata?.display_name) {
            return a.metadata.display_name.localeCompare(
              b.metadata.display_name,
            );
          }
          return 0;
        }),
    [itemList],
  );

  const procedures = useMemo(
    () =>
      itemList
        .filter((item) => item.data_record.resource_type === 'procedure')
        .sort((a, b) => {
          if (a.metadata?.display_name && b.metadata?.display_name) {
            return a.metadata.display_name.localeCompare(
              b.metadata.display_name,
            );
          }
          return 0;
        }),
    [itemList],
  );

  const observations = useMemo(
    () =>
      itemList
        .filter((item) => item.data_record.resource_type === 'observation')
        .sort((a, b) => {
          if (a.metadata?.display_name && b.metadata?.display_name) {
            return a.metadata.display_name.localeCompare(
              b.metadata.display_name,
            );
          }
          return 0;
        }),
    [itemList],
  );

  const medicationStatements = useMemo(
    () =>
      itemList
        .filter(
          (item) => item.data_record.resource_type === 'medicationstatement',
        )
        .sort((a, b) => {
          if (a.metadata?.display_name && b.metadata?.display_name) {
            return a.metadata.display_name.localeCompare(
              b.metadata.display_name,
            );
          }
          return 0;
        }),
    [itemList],
  );

  const diagnosticReports = useMemo(
    () =>
      itemList
        .filter((item) => item.data_record.resource_type === 'diagnosticreport')
        .sort((a, b) => {
          if (a.metadata?.display_name && b.metadata?.display_name) {
            return a.metadata.display_name.localeCompare(
              b.metadata.display_name,
            );
          }
          return 0;
        }),
    [itemList],
  );

  const documentReferences = useMemo(
    () =>
      itemList
        .filter(
          (item) => item.data_record.resource_type === 'documentreference',
        )
        .sort((a, b) => {
          if (a.metadata?.display_name && b.metadata?.display_name) {
            return a.metadata.display_name.localeCompare(
              b.metadata.display_name,
            );
          }
          return 0;
        }),
    [itemList],
  );

  const documentReferenceAttachments = useMemo(
    () =>
      itemList
        .filter(
          (item) =>
            item.data_record.resource_type === 'documentreference_attachment',
        )
        .sort((a, b) => {
          if (a.metadata?.display_name && b.metadata?.display_name) {
            return a.metadata.display_name.localeCompare(
              b.metadata.display_name,
            );
          }
          return 0;
        }),
    [itemList],
  );

  const encounters = useMemo(
    () =>
      itemList
        .filter((item) => item.data_record.resource_type === 'encounter')
        .sort((a, b) => {
          if (a.metadata?.display_name && b.metadata?.display_name) {
            return a.metadata.display_name.localeCompare(
              b.metadata.display_name,
            );
          }
          return 0;
        }),
    [itemList],
  );

  const [expanded, setExpanded] = React.useState(false);

  const titleFields = [
    immunizations.length > 0 ? 'Immunizations' : '',
    conditions.length > 0 ? 'Conditions' : '',
    procedures.length > 0 ? 'Procedures' : '',
    observations.length > 0 ? 'Labs' : '',
    medicationStatements.length > 0 ? 'Medications' : '',
    diagnosticReports.length > 0 ? 'Lab Panels' : '',
    documentReferences.length > 0 || documentReferenceAttachments.length > 0
      ? 'Documents'
      : '',
    encounters.length > 0 ? 'Encounters' : '',
  ].filter(Boolean);

  const title =
    titleFields.length >= 2 && titleFields.length < 3
      ? `Your ${titleFields.join(' & ')} ${dateString ? `from ${dateString}` : ''}`
      : `Your ${titleFields.slice(0, -1).join(', ')}${titleFields.length > 1 ? ', and' : ''} ${titleFields.slice(-1)}  ${dateString ? `from ${dateString}` : ''}`;

  return (
    <CardBase>
      <div className="min-w-0 flex-1 flex-col">
        <TimelineCardCategoryTitle title={title} color="text-primary-600" />
        {encounters.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardTitle>Encounters</TimelineCardTitle>
            <ul className="list-disc list-inside">
              {encounters.map((item) => (
                <li key={item.id}>{item.metadata?.display_name}</li>
              ))}
            </ul>
          </div>
        )}
        {(documentReferences.length > 0 ||
          documentReferenceAttachments.length > 0) && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Documents'}
              color="text-teal-600"
            />
            <ul className="list-disc list-inside">
              {[...documentReferences, ...documentReferenceAttachments].map(
                (item) => (
                  <li
                    className="text-xs font-medium md:text-sm text-gray-900"
                    key={item.id}
                  >
                    {item.metadata?.display_name}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
        {procedures.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Procedures'}
              color="text-blue-600"
            />
            <ul className="list-disc list-inside">
              {procedures.map((item) => (
                <li
                  className="text-xs font-medium md:text-sm text-gray-900"
                  key={item.id}
                >
                  {item.metadata?.display_name}
                </li>
              ))}
            </ul>
          </div>
        )}
        {diagnosticReports.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Lab Panels'}
              color="text-blue-600"
            />
            <ul className="list-disc list-inside">
              {diagnosticReports.map((item) => (
                <li
                  className="text-xs font-medium md:text-sm text-gray-900"
                  key={item.id}
                >
                  {item.metadata?.display_name
                    ?.replace(/- final result/gi, '')
                    .replace(/- final/gi, '')}
                </li>
              ))}
            </ul>
          </div>
        )}
        {observations.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle title={'Labs'} color="text-sky-600" />
            <ul className="list-disc list-inside">
              {observations.map((item) => (
                <li
                  className="text-xs font-medium md:text-sm text-gray-900"
                  key={item.id}
                >
                  {item.metadata?.display_name
                    ?.replace(/- final result/gi, '')
                    .replace(/- final/gi, '')}
                </li>
              ))}
            </ul>
          </div>
        )}
        {immunizations.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Immunizations'}
              color="text-purple-600"
            />
            <ul className="list-disc list-inside">
              {immunizations.map((item) => (
                <li
                  key={item.id}
                  className="text-xs font-medium md:text-sm text-gray-900"
                >
                  {item.metadata?.display_name}
                </li>
              ))}
            </ul>
          </div>
        )}
        {conditions.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Conditions'}
              color="text-green-600"
            />
            <ul className="list-disc list-inside">
              {conditions.map((item) => (
                <li
                  className="text-xs font-medium md:text-sm text-gray-900"
                  key={item.id}
                >
                  {item.metadata?.display_name}
                </li>
              ))}
            </ul>
          </div>
        )}
        {medicationStatements.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Medications'}
              color="text-fuchsia-600"
            />
            <ul className="list-disc list-inside">
              {medicationStatements.map((item) => (
                <li
                  className="text-xs font-medium md:text-sm text-gray-900"
                  key={item.id}
                >
                  {item.metadata?.display_name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          className={`py-2 sm:py-0 text-primary-800 font-medium text-sm md:text-base flex items-center gap-x-1 ring-primary-700 hover:text-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50 active:bg-slate-50 active:scale-95 active:rounded-md active:duration-150 w-full text-center content-center justify-center rounded-md hover:ring-2 hover:ring-primary-500 hover:ring-opacity-50 hover:rounded-md hover:duration-150 hover:bg-primary-50 transition-all duration-150 ease-in-out ${expanded ? 'outline-none bg-primary-50 ring-2' : ''}`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'View Less' : 'View More'}
          <ChevronDownIcon
            className={`h-3 w-3 rounded duration-150 active:scale-95 active:bg-slate-50 ${expanded ? 'rotate-180 transform' : ''}`}
          />
        </button>
        <Transition
          show={expanded}
          enter="transition-all transform duration-150 origin-top"
          enterFrom="opacity-0 scale-y-0"
          enterTo="opacity-100 scale-y-100"
          leave="transition-all transform duration-150 origin-top"
          leaveFrom="opacity-100 scale-y-100"
          leaveTo="opacity-0 scale-y-0"
        >
          <div>
            {encounters.map((item) => (
              <div key={item.id} className="my-2">
                <EncounterCard
                  key={item.id}
                  item={item as ClinicalDocument<BundleEntry<Encounter>>}
                />
              </div>
            ))}
            {documentReferences.map((item) => (
              <div key={item.id} className="my-2">
                <DocumentReferenceCard
                  key={item.id}
                  item={
                    item as ClinicalDocument<BundleEntry<DocumentReference>>
                  }
                />
              </div>
            ))}
            {documentReferenceAttachments.map((item) => (
              <div key={item.id} className="my-2">
                <DocumentReferenceAttachmentCard
                  key={item.id}
                  item={item as unknown as ClinicalDocument<string>}
                />
              </div>
            ))}
            {procedures.map((item) => (
              <div key={item.id} className="my-2">
                <ProcedureCard
                  key={item.id}
                  item={item as ClinicalDocument<BundleEntry<Procedure>>}
                />
              </div>
            ))}
            {diagnosticReports.map((item) => (
              <div key={item.id} className="my-2">
                <DiagnosticReportCard
                  key={item.id}
                  item={item as ClinicalDocument<BundleEntry<DiagnosticReport>>}
                />
              </div>
            ))}
            {observations.map((item) => (
              <div key={item.id} className="my-2">
                <ObservationCard
                  key={item.id}
                  item={item as ClinicalDocument<BundleEntry<Observation>>}
                />
              </div>
            ))}
            {immunizations.map((item) => (
              <div key={item.id} className="my-2">
                <ImmunizationCard
                  key={item.id}
                  item={item as ClinicalDocument<BundleEntry<Immunization>>}
                />
              </div>
            ))}
            {conditions.map((item) => (
              <div key={item.id} className="my-2">
                <ConditionCard
                  key={item.id}
                  item={item as ClinicalDocument<BundleEntry<Condition>>}
                />
              </div>
            ))}
            {medicationStatements.map((item) => (
              <div key={item.id} className="my-2">
                <MedicationCard
                  key={item.id}
                  item={
                    item as ClinicalDocument<BundleEntry<MedicationStatement>>
                  }
                />
              </div>
            ))}
          </div>
        </Transition>
      </div>
    </CardBase>
  );
});
