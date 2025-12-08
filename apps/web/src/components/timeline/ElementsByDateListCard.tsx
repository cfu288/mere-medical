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
import {
  MedicationRequest,
  BundleEntry as R4BundleEntry,
  Coverage,
  CarePlan,
  CareTeam,
  Goal,
  Appointment,
  Specimen,
} from 'fhir/r4';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  getEncounterClass,
  getEncounterLocation,
  getDiagnosticReportPerformer,
  getObservationPerformer,
  getProcedurePerformer,
} from '../../utils/fhirAccessHelpers';

import { Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { MapPinIcon, UserIcon } from '@heroicons/react/24/outline';

import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { CardBase } from '../connection/CardBase';
import { useConnectionDocs } from '../hooks/useConnectionDoc';
import { AppointmentCard } from './AppointmentCard';
import { CarePlanCard } from './CarePlanCard';
import { CareTeamCard } from './CareTeamCard';
import { ConditionCard } from './ConditionCard';
import { CoverageCard } from './CoverageCard';
import { DiagnosticReportCard } from './DiagnosticReportCard';
import {
  DocumentReferenceAttachmentCard,
  DocumentReferenceCard,
} from './DocumentReferenceCard';
import { EncounterCard } from './EncounterCard';
import { GoalCard } from './GoalCard';
import { ImmunizationCard } from './ImmunizationCard';
import { MedicationCard } from './MedicationCard';
import { MedicationRequestCard } from './MedicationRequestCard';
import { ObservationCard } from './ObservationCard';
import { ProcedureCard } from './ProcedureCard';
import { SpecimenCard } from './SpecimenCard';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { TimelineCardTitle } from './TimelineCardTitle';
import { useClinicalDoc } from '../hooks/useClinicalDoc';
import { CCDAStructureDefinitionKeys2_1 } from './ShowDocumentReferenceResultsExpandable/CCDAStructureDefinitionKeys2_1';
import useIntersectionObserver from '../hooks/useIntersectionObserver';
import { checkIfXmlIsCCDA } from './ShowDocumentReferenceResultsExpandable/ShowDocumentReferenceAttachmentExpandable';
import { parseCCDA } from './ShowDocumentReferenceResultsExpandable/parseCCDA/parseCCDA';
import parse, { HTMLReactParserOptions, domToReact } from 'html-react-parser';
import DOMPurify from 'dompurify';

const options: HTMLReactParserOptions = {
  replace(domNode) {
    if ((domNode as unknown as Element).tagName === 'content') {
      return (
        <p className="whitespace-pre-line">
          {domToReact(
            [...((domNode as unknown as Element).children as any)],
            options,
          )}
        </p>
      );
    }
    // else if ((domNode as unknown as Element).tagName === 'br') {
    //   return <></>;
    // }
    return domNode;
  },
};

function DocumentListItem({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DocumentReference>>;
}) {
  const [ccda, setCCDA] = useState<
      | Partial<Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>>
      | undefined
    >(undefined),
    attachmentUrl = item.data_record.raw.resource?.content?.[0].attachment.url,
    attachment = useClinicalDoc(attachmentUrl),
    [hasLoadedDocument, setHasLoadedDocument] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const entry = useIntersectionObserver(ref, {});
  const isVisible = !!entry?.isIntersecting;

  useEffect(() => {
    if (isVisible) {
      if (
        attachment?.get('data_record.content_type') === 'application/xml' &&
        checkIfXmlIsCCDA(attachment.get('data_record.raw'))
      ) {
        const parsedDoc = parseCCDA(attachment.get('data_record.raw'), true);
        setHasLoadedDocument(true);
        setCCDA(parsedDoc);
      } else {
        setHasLoadedDocument(true);
      }
    }
  }, [isVisible, attachment]);

  const sanitizedData = useMemo(() => {
    const data = (ccda?.HISTORY_OF_PRESENT_ILLNESS_SECTION ||
      ccda?.PROGRESS_NOTE) as string;
    return parse(DOMPurify.sanitize(data), options);
  }, [ccda?.HISTORY_OF_PRESENT_ILLNESS_SECTION, ccda?.PROGRESS_NOTE]);

  const hasTextData =
    ccda?.HISTORY_OF_PRESENT_ILLNESS_SECTION || ccda?.PROGRESS_NOTE;

  return (
    <>
      <li className="text-xs font-medium md:text-sm text-gray-900" ref={ref}>
        {item.metadata?.display_name}
      </li>
      {hasLoadedDocument && hasTextData ? (
        <p className="w-full min-w-full shadow-inner bg-gray-50 rounded-md my-2 max-h-48 overflow-y-auto overflow-x-auto p-2 sm:prose prose-sm prose-neutral [&_table]:table-auto [&_tr]:border-b [&_caption]:text-center">
          {sanitizedData}
        </p>
      ) : null}
    </>
  );
}

function DispayDocumentReferencesOrAttachmentTimelineItem(props: {
  documentReferences: ClinicalDocument<BundleEntry<FhirResource>>[];
  documentReferenceAttachments: ClinicalDocument<BundleEntry<FhirResource>>[];
}) {
  const docsToDisplay = [
    ...props.documentReferences,
    ...props.documentReferenceAttachments,
  ];
  return (
    <div className="mb-2 ml-2">
      <TimelineCardCategoryTitle title={'Documents'} color="text-teal-600" />
      <ul className="list-disc list-inside">
        {docsToDisplay.slice(0, 5).map((item) => (
          <DocumentListItem
            key={item.id}
            item={item as ClinicalDocument<BundleEntry<DocumentReference>>}
          />
        ))}
        <p className="text-xs font-medium md:text-sm text-gray-900">
          {docsToDisplay.length > 5
            ? `... and ${docsToDisplay.length - 5} more`
            : null}
        </p>
      </ul>
    </div>
  );
}

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
    medicationRequests = useMemo(
      () =>
        itemList
          .filter(
            (item) => item.data_record.resource_type === 'medicationrequest',
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
          }) as ClinicalDocument<BundleEntry<Encounter>>[],
      [itemList],
    ),
    coverages = useMemo(
      () =>
        itemList
          .filter((item) => item.data_record.resource_type === 'coverage')
          .sort((a, b) => {
            if (a.metadata?.display_name && b.metadata?.display_name) {
              return a.metadata.display_name.localeCompare(
                b.metadata.display_name,
              );
            }
            return 0;
          }) as ClinicalDocument<R4BundleEntry<Coverage>>[],
      [itemList],
    ),
    carePlans = useMemo(
      () =>
        itemList
          .filter((item) => item.data_record.resource_type === 'careplan')
          .sort((a, b) => {
            if (a.metadata?.display_name && b.metadata?.display_name) {
              return a.metadata.display_name.localeCompare(
                b.metadata.display_name,
              );
            }
            return 0;
          }) as ClinicalDocument<R4BundleEntry<CarePlan>>[],
      [itemList],
    ),
    careTeams = useMemo(
      () =>
        itemList
          .filter((item) => item.data_record.resource_type === 'careteam')
          .sort((a, b) => {
            if (a.metadata?.display_name && b.metadata?.display_name) {
              return a.metadata.display_name.localeCompare(
                b.metadata.display_name,
              );
            }
            return 0;
          }) as ClinicalDocument<R4BundleEntry<CareTeam>>[],
      [itemList],
    ),
    goals = useMemo(
      () =>
        itemList
          .filter((item) => item.data_record.resource_type === 'goal')
          .sort((a, b) => {
            if (a.metadata?.display_name && b.metadata?.display_name) {
              return a.metadata.display_name.localeCompare(
                b.metadata.display_name,
              );
            }
            return 0;
          }) as ClinicalDocument<R4BundleEntry<Goal>>[],
      [itemList],
    ),
    appointments = useMemo(
      () =>
        itemList
          .filter((item) => item.data_record.resource_type === 'appointment')
          .sort((a, b) => {
            if (a.metadata?.display_name && b.metadata?.display_name) {
              return a.metadata.display_name.localeCompare(
                b.metadata.display_name,
              );
            }
            return 0;
          }) as ClinicalDocument<R4BundleEntry<Appointment>>[],
      [itemList],
    ),
    specimens = useMemo(
      () =>
        itemList
          .filter((item) => item.data_record.resource_type === 'specimen')
          .sort((a, b) => {
            if (a.metadata?.display_name && b.metadata?.display_name) {
              return a.metadata.display_name.localeCompare(
                b.metadata.display_name,
              );
            }
            return 0;
          }) as ClinicalDocument<R4BundleEntry<Specimen>>[],
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
        medicationStatements.length > 0 || medicationRequests.length > 0
          ? 'Medications'
          : '',
        diagnosticReports.length > 0 ? 'Lab Panels' : '',
        documentReferences.length > 0 || documentReferenceAttachments.length > 0
          ? 'Documents'
          : '',
        encounters.length > 0 ? 'Encounters' : '',
        coverages.length > 0 ? 'Coverage' : '',
        carePlans.length > 0 ? 'Care Plans' : '',
        careTeams.length > 0 ? 'Care Teams' : '',
        goals.length > 0 ? 'Goals' : '',
        appointments.length > 0 ? 'Appointments' : '',
        specimens.length > 0 ? 'Specimens' : '',
      ].filter(Boolean),
    [
      conditions.length,
      diagnosticReports.length,
      documentReferenceAttachments.length,
      documentReferences.length,
      encounters.length,
      immunizations.length,
      medicationStatements.length,
      medicationRequests.length,
      observations.length,
      procedures.length,
      coverages.length,
      carePlans.length,
      careTeams.length,
      goals.length,
      appointments.length,
      specimens.length,
    ],
  );

  const uniqueConnectionIds = useMemo(() => {
    const uniqueDocs = new Set(
      itemList.map((item) => item.connection_record_id),
    );
    return Array.from(uniqueDocs);
  }, [itemList]);

  const uniqueAuthors = useMemo(() => {
    const performers = itemList
      .map((item) => {
        switch (item.data_record.resource_type) {
          case 'diagnosticreport':
            return getDiagnosticReportPerformer(item);
          case 'observation':
            return getObservationPerformer(item);
          case 'procedure':
            return getProcedurePerformer(item);
          default:
            return undefined;
        }
      })
      .filter(Boolean);
    return Array.from(new Set(performers));
  }, [itemList]);

  const connectionDocs = useConnectionDocs(uniqueConnectionIds);

  const title =
    titleFields.length >= 2 && titleFields.length < 3
      ? `Your ${titleFields.join(' & ')}`
      : `Your ${titleFields.slice(0, -1).join(', ')}${titleFields.length > 1 ? ', and' : ''} ${titleFields.slice(-1)}`;

  return (
    <CardBase>
      <div className="min-w-0 flex-1 flex-col">
        <div
          className={`text-lg font-bold flex flex-row items-center align-middle sm:text-2xl sm:mb-1 text-primary-600`}
        >
          {title}
        </div>
        <div className="flex sm:flex-row flex-col sm:justify-between">
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
          <div className="flex flex-col">
            {uniqueAuthors.length > 0 &&
              uniqueAuthors.map((author) => (
                <p className="mr-1 flex flex-row align-center items-center text-gray-900 text-sm md:text-base">
                  <UserIcon className="mr-1 h-4 sm:h-5 w-auto inline-block text-primary-700" />
                  {author}
                </p>
              ))}
          </div>
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
            <TimelineCardCategoryTitle
              title={'Encounters'}
              color="text-red-500"
            />
            <ul className="list-disc list-inside">
              {encounters.map((item) => (
                <li
                  key={item.id}
                  className="text-xs font-medium md:text-sm text-gray-900"
                >
                  <p className="capitalize inline-block">{`${getEncounterClass(item)} -`}</p>
                  <p className="inline-block ml-1">
                    {`${getEncounterLocation(item)}`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(documentReferences.length > 0 ||
          documentReferenceAttachments.length > 0) && (
          <DispayDocumentReferencesOrAttachmentTimelineItem
            documentReferences={documentReferences}
            documentReferenceAttachments={documentReferenceAttachments}
          />
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
              {diagnosticReports.slice(0, 5).map((item) => (
                <li
                  className="text-xs font-medium md:text-sm text-gray-900"
                  key={item.id}
                >
                  {item.metadata?.display_name
                    ?.replace(/- final result/gi, '')
                    .replace(/- final/gi, '')}
                </li>
              ))}
              <p className="text-xs font-medium md:text-sm text-gray-900">
                {diagnosticReports.length > 5
                  ? `... and ${diagnosticReports.length - 5} more`
                  : null}
              </p>
            </ul>
          </div>
        )}
        {observations.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle title={'Labs'} color="text-sky-600" />
            <ul className="list-disc list-inside">
              {observations.slice(0, 5).map((item) => (
                <li
                  className="text-xs font-medium md:text-sm text-gray-900"
                  key={item.id}
                >
                  {item.metadata?.display_name
                    ?.replace(/- final result/gi, '')
                    .replace(/- final/gi, '')}
                </li>
              ))}
              <p className="text-xs font-medium md:text-sm text-gray-900">
                {observations.length > 5
                  ? `... and ${observations.length - 5} more`
                  : null}
              </p>
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
        {(medicationStatements.length > 0 || medicationRequests.length > 0) && (
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
              {medicationRequests.map((item) => (
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
        {coverages.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Coverage'}
              color="text-amber-600"
            />
            <ul className="list-disc list-inside">
              {coverages.map((item) => (
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
        {carePlans.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Care Plans'}
              color="text-indigo-600"
            />
            <ul className="list-disc list-inside">
              {carePlans.map((item) => (
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
        {careTeams.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Care Teams'}
              color="text-cyan-600"
            />
            <ul className="list-disc list-inside">
              {careTeams.map((item) => (
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
        {goals.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Goals'}
              color="text-emerald-600"
            />
            <ul className="list-disc list-inside">
              {goals.map((item) => (
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
        {appointments.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Appointments'}
              color="text-violet-600"
            />
            <ul className="list-disc list-inside">
              {appointments.map((item) => (
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
        {specimens.length > 0 && (
          <div className="mb-2 ml-2">
            <TimelineCardCategoryTitle
              title={'Specimens'}
              color="text-orange-600"
            />
            <ul className="list-disc list-inside">
              {specimens.map((item) => (
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
            {medicationRequests.map((item) => (
              <div key={item.id} className="my-2">
                <MedicationRequestCard
                  key={item.id}
                  item={
                    item as unknown as ClinicalDocument<
                      R4BundleEntry<MedicationRequest>
                    >
                  }
                />
              </div>
            ))}
            {coverages.map((item) => (
              <div key={item.id} className="my-2">
                <CoverageCard
                  key={item.id}
                  item={item}
                />
              </div>
            ))}
            {carePlans.map((item) => (
              <div key={item.id} className="my-2">
                <CarePlanCard
                  key={item.id}
                  item={item}
                />
              </div>
            ))}
            {careTeams.map((item) => (
              <div key={item.id} className="my-2">
                <CareTeamCard
                  key={item.id}
                  item={item}
                />
              </div>
            ))}
            {goals.map((item) => (
              <div key={item.id} className="my-2">
                <GoalCard
                  key={item.id}
                  item={item}
                />
              </div>
            ))}
            {appointments.map((item) => (
              <div key={item.id} className="my-2">
                <AppointmentCard
                  key={item.id}
                  item={item}
                />
              </div>
            ))}
            {specimens.map((item) => (
              <div key={item.id} className="my-2">
                <SpecimenCard
                  key={item.id}
                  item={item}
                />
              </div>
            ))}
          </div>
        </Transition>
      </div>
    </CardBase>
  );
});
