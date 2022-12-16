import { Disclosure } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { BundleEntry, DocumentReference } from 'fhir/r2';
import { useEffect, useState } from 'react';
import { ClinicalDocument } from '../models/ClinicalDocument';
import { Modal } from './Modal';
import { ModalHeader } from './ModalHeader';
import { useClinicalDoc } from './Timeline/useClinicalDoc';
import { useConnectionDoc } from './Timeline/useConnectionDoc';

export enum CCDAStructureDefinition {
  CARE_TEAMS = '2.16.840.1.113883.10.20.22.2.500',
  HPI = '1.3.6.1.4.1.19376.1.5.3.1.3.4',
  PATIENT_INSTRUCTIONS = '2.16.840.1.113883.10.20.22.2.45',
  PLAN_OF_TREATMENT = '2.16.840.1.113883.10.20.22.2.10',
  RESULTS = '2.16.840.1.113883.10.20.22.2.3',
  VISIT_DIAGNOSIS = '2.16.840.1.113883.10.20.22.2.8',
  VITAL_SIGNS = '2.16.840.1.113883.10.20.22.2.4',
}
export interface CCDAParsed {
  careTeam: string;
  hpi: string;
  patientInstructions: string;
  results: string;
  planOfTreatment: string;
  visitDiagnoses: string;
  vitalSigns: string;
}

function parseCCDASection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: CCDAStructureDefinition
) {
  const matchingSections = [...(sections as unknown as HTMLElement[])]?.filter(
    (s) =>
      s.getElementsByTagName('templateId')?.[0]?.getAttribute('root') === id
  );
  return [...(matchingSections as unknown as HTMLElement[])]?.map(
    (x) => x.innerHTML
  )?.[0];
}

function parseCCDA(raw: string): CCDAParsed {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(raw, 'text/xml');
  const sections = xmlDoc.getElementsByTagName('section');

  const hpi = parseCCDASection(sections, CCDAStructureDefinition.HPI);
  const vitalSigns = parseCCDASection(
    sections,
    CCDAStructureDefinition.VITAL_SIGNS
  );
  const visitDiagnoses = parseCCDASection(
    sections,
    CCDAStructureDefinition.VISIT_DIAGNOSIS
  );
  const careTeam = parseCCDASection(
    sections,
    CCDAStructureDefinition.CARE_TEAMS
  );
  const results = parseCCDASection(sections, CCDAStructureDefinition.RESULTS);
  const patientInstructions = parseCCDASection(
    sections,
    CCDAStructureDefinition.PATIENT_INSTRUCTIONS
  );
  const planOfTreatment = parseCCDASection(
    sections,
    CCDAStructureDefinition.PLAN_OF_TREATMENT
  );

  const parsedDoc = {
    hpi,
    vitalSigns,
    visitDiagnoses,
    careTeam,
    results,
    patientInstructions,
    planOfTreatment,
  };
  return parsedDoc;
}

function checkIfXmlIsCCDA(xml: string): boolean {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('ClinicalDocument');
    return sections.length > 0;
  } catch (e) {
    return false;
  }
}

export function ShowDocumentResultsExpandable({
  item,
  expanded,
  setExpanded,
}: {
  item: ClinicalDocument<BundleEntry<DocumentReference>>;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const cd = useConnectionDoc(item.source_record),
    [ccda, setCCDA] = useState<CCDAParsed | undefined>(undefined),
    toggleOpen = () => setExpanded((x) => !x),
    attachmentUrl = item.data_record.raw.resource?.content?.[0].attachment.url,
    attachment = useClinicalDoc(attachmentUrl);

  useEffect(() => {
    if (expanded) {
      if (
        attachment?.get('data_record.content_type') === 'application/xml' &&
        checkIfXmlIsCCDA(attachment.get('data_record.raw'))
      ) {
        const parsedDoc = parseCCDA(attachment.get('data_record.raw'));
        setCCDA(parsedDoc);
      }
    }
  }, [expanded, cd, attachment]);

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || ''}
          setClose={() => setExpanded(false)}
        />
        <div className="max-h-full  scroll-py-3 p-3">
          <div
            className={`${
              expanded ? '' : 'hidden'
            } rounded-lg border border-solid border-gray-200`}
          >
            <p className="text-md whitespace-wrap overflow-x-scroll p-4 text-gray-900">
              {!ccda && 'Loading...'}
              {ccda?.vitalSigns && (
                <DisplayCCDASection
                  title="Vital Signs"
                  content={ccda.vitalSigns || ''}
                />
              )}
              {ccda?.hpi && (
                <DisplayCCDASection
                  title="History of Present Illness"
                  content={ccda.hpi || ''}
                />
              )}
              {ccda?.results && (
                <DisplayCCDASection
                  title="Results"
                  content={ccda.results || ''}
                />
              )}
              {ccda?.visitDiagnoses && (
                <DisplayCCDASection
                  title="Visit Diagnoses"
                  content={ccda.visitDiagnoses || ''}
                />
              )}
              {ccda?.planOfTreatment && (
                <DisplayCCDASection
                  title="Plan of Treatment"
                  content={ccda.planOfTreatment || ''}
                />
              )}
              {ccda?.patientInstructions && (
                <DisplayCCDASection
                  title="Patient Instructions"
                  content={ccda.patientInstructions || ''}
                />
              )}
              {ccda?.careTeam && (
                <DisplayCCDASection
                  title="Care Team"
                  content={ccda.careTeam || ''}
                />
              )}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DisplayCCDASection({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <Disclosure>
      {({ open }) => (
        <>
          <Disclosure.Button className="mb-2 w-full rounded-md bg-gray-100 p-2 font-bold">
            <div className="flex w-full items-center justify-between">
              {title}
              <ChevronRightIcon
                className={` h-8 w-8 ${open ? 'rotate-90 transform' : ''}`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="m-4 text-sm text-gray-700">
            <p
              className="p-2"
              dangerouslySetInnerHTML={{
                __html: content || '',
              }}
            ></p>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
