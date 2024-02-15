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

import { Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { MapPinIcon } from '@heroicons/react/24/outline';

import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { CardBase } from '../connection/CardBase';
import { useConnectionDocs } from '../hooks/useConnectionDoc';
import { ConditionCard } from './ConditionCard';
import { DiagnosticReportCard } from './DiagnosticReportCard';
import {
  DocumentReferenceAttachmentCard,
  DocumentReferenceCard,
} from './DocumentReferenceCard';
import { EncounterCard } from './EncounterCard';
import { ImmunizationCard } from './ImmunizationCard';
import { MedicationCard } from './MedicationCard';
import { ObservationCard } from './ObservationCard';
import { ProcedureCard } from './ProcedureCard';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { TimelineCardTitle } from './TimelineCardTitle';

export const ElementsByDateListCard = memo(function ElementsByDateListCard({
  itemList,
}: {
  itemList: ClinicalDocument<BundleEntry<FhirResource>>[];
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
    ),
    conditions = useMemo(
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
    ),
    procedures = useMemo(
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
    ),
    observations = useMemo(
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
    ),
    medicationStatements = useMemo(
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
    ),
    diagnosticReports = useMemo(
      () =>
        itemList
          .filter(
            (item) => item.data_record.resource_type === 'diagnosticreport',
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
    ),
    documentReferences = useMemo(
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
    ),
    documentReferenceAttachments = useMemo(
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
    ),
    encounters = useMemo(
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

  const titleFields = useMemo(
    () =>
      [
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
      ].filter(Boolean),
    [
      conditions.length,
      diagnosticReports.length,
      documentReferenceAttachments.length,
      documentReferences.length,
      encounters.length,
      immunizations.length,
      medicationStatements.length,
      observations.length,
      procedures.length,
    ],
  );

  const title =
    titleFields.length >= 2 && titleFields.length < 3
      ? `Your ${titleFields.join(' & ')}` // ${dateString ? `from ${dateString}` : ''}`
      : `Your ${titleFields.slice(0, -1).join(', ')}${titleFields.length > 1 ? ', and' : ''} ${titleFields.slice(-1)}`; //  ${dateString ? `from ${dateString}` : ''}`;

  const uniqueConnectionIds = useMemo(() => {
    const uniqueDocs = new Set(
      itemList.map((item) => item.connection_record_id),
    );
    return Array.from(uniqueDocs);
  }, [itemList]);

  const connectionDocs = useConnectionDocs(uniqueConnectionIds);

  return (
    <CardBase>
      <div className="min-w-0 flex-1 flex-col">
        <div
          className={`text-lg font-bold flex flex-row items-center align-middle sm:text-2xl sm:mb-1 text-primary-600`}
        >
          {title}
        </div>
        <div className="flex flex-col">
          {connectionDocs.map((conn) =>
            conn?.get('name') ? (
              <p className="mr-1 flex flex-row align-center items-center text-gray-900 text-sm md:text-base">
                <MapPinIcon className="mr-1 h-4 sm:h-5 w-auto inline-block text-primary-700" />
                {conn?.get('name')}
              </p>
            ) : null,
          )}
        </div>
        <div className="relative h-4">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div className="w-full border-t border-gray-300" />
          </div>
        </div>
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
        <div className="relative">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-x-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'View Less' : 'View More'}

              <ChevronDownIcon
                className={`-ml-1 -mr-0.5 h-5 w-5 text-gray-400 duration-150 active:scale-95 active:bg-slate-50 ${expanded ? 'rotate-180 transform' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
        <Transition
          show={expanded}
          enter="transition-all transform duration-150 origin-top"
          enterFrom="opacity-0 scale-y-0"
          enterTo="opacity-100 scale-y-100"
          leave="transition-all transform duration-150 origin-top"
          leaveFrom="opacity-100 scale-y-100"
          leaveTo="opacity-0 scale-y-0"
        >
          <div className="mt-4">
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
