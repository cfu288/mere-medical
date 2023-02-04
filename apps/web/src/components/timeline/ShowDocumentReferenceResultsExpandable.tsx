import { Disclosure } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { BundleEntry, DocumentReference } from 'fhir/r2';
import { useEffect, useState } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';
import { useClinicalDoc } from '../hooks/useClinicalDoc';
import { useConnectionDoc } from '../hooks/useConnectionDoc';

type CCDAStructureDefinitionKeys =
  | 'CARE_TEAMS'
  | 'HPI'
  | 'PATIENT_INSTRUCTIONS'
  | 'PLAN_OF_TREATMENT'
  | 'RESULTS'
  | 'VISIT_DIAGNOSIS'
  | 'VITAL_SIGNS'
  | 'REASON_FOR_REFERRAL'
  | 'ASSESSMENT'
  | 'PROBLEMS'
  | 'MEDICATIONS'
  | 'PROCEDURES'
  | 'IMMUNIZATIONS'
  | 'HOSPITAL_DISCHARGE_INSTRUCTIONS'
  // TODO: below
  | 'FAMILY_HISTORY'
  | 'SOCIAL_HISTORY'
  | 'FOREIGN_TRAVEL'
  | 'HEALTH_CONCERNS'
  | 'GOALS'
  | 'NUTRITION'
  | 'MEDICAL_EQUIPMENT'
  | 'ADVANCE_DIRECTIVES'
  | 'ENCOUNTERS'
  | 'PAYERS';

const CCDAStructureDefinition: Record<
  CCDAStructureDefinitionKeys,
  string | string[]
> = {
  CARE_TEAMS: '2.16.840.1.113883.10.20.22.2.500',
  HPI: '1.3.6.1.4.1.19376.1.5.3.1.3.4',
  PATIENT_INSTRUCTIONS: '2.16.840.1.113883.10.20.22.2.45',
  PLAN_OF_TREATMENT: '2.16.840.1.113883.10.20.22.2.10',
  RESULTS: '2.16.840.1.113883.10.20.22.2.3',
  VISIT_DIAGNOSIS: '2.16.840.1.113883.10.20.22.2.8',
  VITAL_SIGNS: '2.16.840.1.113883.10.20.22.2.4',
  REASON_FOR_REFERRAL: '1.3.6.1.4.1.19376.1.5.3.1.3.1',
  ASSESSMENT: '2.16.840.1.113883.10.20.22.2.8',
  PROBLEMS: [
    '2.16.840.1.113883.10.20.22.2.5',
    '2.16.840.1.113883.10.20.22.2.5.1',
  ],
  MEDICATIONS: [
    '2.16.840.1.113883.10.20.22.2.1',
    '2.16.840.1.113883.10.20.22.2.1.1',
  ],
  PROCEDURES: [
    '2.16.840.1.113883.10.20.22.2.7',
    '2.16.840.1.113883.10.20.22.2.7.1',
  ],
  IMMUNIZATIONS: [
    '2.16.840.1.113883.10.20.22.2.2',
    '2.16.840.1.113883.10.20.22.2.2.1',
  ],
  HOSPITAL_DISCHARGE_INSTRUCTIONS: '2.16.840.1.113883.10.20.22.2.41',
  FAMILY_HISTORY: '2.16.840.1.113883.10.20.22.2.15',
  SOCIAL_HISTORY: '2.16.840.1.113883.10.20.22.2.17',
  FOREIGN_TRAVEL: '1.3.6.1.4.19376.1.5.3.1.1.5.3.6',
  HEALTH_CONCERNS: '2.16.840.1.113883.10.20.22.2.58',
  GOALS: '2.16.840.1.113883.10.20.22.2.60',
  NUTRITION: '2.16.840.1.113883.10.20.22.2.57',
  MEDICAL_EQUIPMENT: '2.16.840.1.113883.10.20.22.2.23',
  ADVANCE_DIRECTIVES: [
    '2.16.840.1.113883.10.20.22.2.21',
    '2.16.840.1.113883.10.20.22.2.21.1',
  ],
  ENCOUNTERS: '2.16.840.1.113883.10.20.22.2.22.1',
  PAYERS: '2.16.840.1.113883.10.20.22.2.18',
};

function parseCCDASection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  const matchingSections = [...(sections as unknown as HTMLElement[])]?.filter(
    (s) =>
      Array.isArray(id)
        ? id.includes(
            s.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ||
              ''
          )
        : s.getElementsByTagName('templateId')?.[0]?.getAttribute('root') === id
  );
  return [...(matchingSections as unknown as HTMLElement[])]
    ?.map((x) => x.innerHTML)
    .flat()
    .join();
}

function parseCCDA(
  raw: string
): Partial<Record<CCDAStructureDefinitionKeys, string>> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(raw, 'text/xml');
  const sections = xmlDoc.getElementsByTagName('section');
  const parsedDoc: Partial<Record<CCDAStructureDefinitionKeys, string>> = {};

  for (const [key, val] of Object.entries(CCDAStructureDefinition)) {
    const k = key as CCDAStructureDefinitionKeys;
    parsedDoc[k] = parseCCDASection(sections, val);
  }

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
  const cd = useConnectionDoc(item.connection_record_id),
    [ccda, setCCDA] = useState<
      Partial<Record<CCDAStructureDefinitionKeys, string>> | undefined
    >(undefined),
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
              {!ccda && 'Loading...'}{' '}
              {ccda?.REASON_FOR_REFERRAL && (
                <DisplayCCDASection
                  title="Reason for Referral"
                  content={ccda.REASON_FOR_REFERRAL || ''}
                />
              )}
              {ccda?.VITAL_SIGNS && (
                <DisplayCCDASection
                  title="Vital Signs"
                  content={ccda.VITAL_SIGNS || ''}
                />
              )}
              {ccda?.HPI && (
                <DisplayCCDASection
                  title="History of Present Illness"
                  content={ccda.HPI || ''}
                />
              )}
              {ccda?.MEDICATIONS && (
                <DisplayCCDASection
                  title="Medications"
                  content={ccda.MEDICATIONS || ''}
                />
              )}
              {ccda?.IMMUNIZATIONS && (
                <DisplayCCDASection
                  title="Immunizations"
                  content={ccda.IMMUNIZATIONS || ''}
                />
              )}
              {ccda?.FAMILY_HISTORY && (
                <DisplayCCDASection
                  title="Family History"
                  content={ccda.FAMILY_HISTORY || ''}
                />
              )}
              {ccda?.SOCIAL_HISTORY && (
                <DisplayCCDASection
                  title="Social History"
                  content={ccda.SOCIAL_HISTORY || ''}
                />
              )}
              {ccda?.FOREIGN_TRAVEL && (
                <DisplayCCDASection
                  title="Foreign Travel"
                  content={ccda.FOREIGN_TRAVEL || ''}
                />
              )}
              {ccda?.HEALTH_CONCERNS && (
                <DisplayCCDASection
                  title="Health Concerns"
                  content={ccda.HEALTH_CONCERNS || ''}
                />
              )}
              {ccda?.PROCEDURES && (
                <DisplayCCDASection
                  title="Procedures"
                  content={ccda.PROCEDURES || ''}
                />
              )}
              {ccda?.RESULTS && (
                <DisplayCCDASection
                  title="Results"
                  content={ccda.RESULTS || ''}
                />
              )}
              {ccda?.VISIT_DIAGNOSIS && (
                <DisplayCCDASection
                  title="Visit Diagnoses"
                  content={ccda.VISIT_DIAGNOSIS || ''}
                />
              )}
              {ccda?.ASSESSMENT && (
                <DisplayCCDASection
                  title="Assessment"
                  content={ccda.ASSESSMENT || ''}
                />
              )}
              {ccda?.PROBLEMS && (
                <DisplayCCDASection
                  title="Problems"
                  content={ccda.PROBLEMS || ''}
                />
              )}
              {ccda?.NUTRITION && (
                <DisplayCCDASection
                  title="Nutrition"
                  content={ccda.NUTRITION || ''}
                />
              )}
              {ccda?.PLAN_OF_TREATMENT && (
                <DisplayCCDASection
                  title="Plan of Treatment"
                  content={ccda.PLAN_OF_TREATMENT || ''}
                />
              )}
              {ccda?.GOALS && (
                <DisplayCCDASection title="Goals" content={ccda.GOALS || ''} />
              )}
              {ccda?.MEDICAL_EQUIPMENT && (
                <DisplayCCDASection
                  title="Medical Equipment"
                  content={ccda.MEDICAL_EQUIPMENT || ''}
                />
              )}
              {ccda?.ADVANCE_DIRECTIVES && (
                <DisplayCCDASection
                  title="Advance Directives"
                  content={ccda.ADVANCE_DIRECTIVES || ''}
                />
              )}
              {ccda?.PATIENT_INSTRUCTIONS && (
                <DisplayCCDASection
                  title="Patient Instructions"
                  content={ccda.PATIENT_INSTRUCTIONS || ''}
                />
              )}
              {ccda?.HOSPITAL_DISCHARGE_INSTRUCTIONS && (
                <DisplayCCDASection
                  title="Hospital Discharge Instructions"
                  content={ccda.HOSPITAL_DISCHARGE_INSTRUCTIONS || ''}
                />
              )}
              {ccda?.ENCOUNTERS && (
                <DisplayCCDASection
                  title="Encounters"
                  content={ccda.ENCOUNTERS || ''}
                />
              )}
              {ccda?.CARE_TEAMS && (
                <DisplayCCDASection
                  title="Care Team"
                  content={ccda.CARE_TEAMS || ''}
                />
              )}
              {ccda?.PAYERS && (
                <DisplayCCDASection
                  title="Payers"
                  content={ccda.PAYERS || ''}
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
