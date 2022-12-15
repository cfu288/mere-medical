import { BundleEntry, DocumentReference, Observation } from 'fhir/r2';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { RxDocument } from 'rxdb';
import { ClinicalDocument } from '../models/ClinicalDocument';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { Modal } from './Modal';
import { ModalHeader } from './ModalHeader';
import { useRxDb } from './RxDbProvider';
import { useClinicalDoc } from './Timeline/useAttachmentDoc';
import { useConnectionDoc } from './Timeline/useConnectionDoc';

export enum CCDAStructureDefinition {
  VITAL_SIGNS = '2.16.840.1.113883.10.20.22.2.4',
  PATIENT_INSTRUCTIONS = '2.16.840.1.113883.10.20.22.2.45',
  HPI = '1.3.6.1.4.1.19376.1.5.3.1.3.4',
  PLAN_OF_TREATMENT = '2.16.840.1.113883.10.20.22.2.10',
  RESULTS = '2.16.840.1.113883.10.20.22.2.3',
  VISIT_DIAGNOSIS = '2.16.840.1.113883.10.20.22.2.8',
  CARE_TEAMS = '2.16.840.1.113883.10.20.22.2.500',
}
export interface CCDAParsed {
  hpi: string;
  vitalSigns: string;
}

function parseCCDA(raw: string): CCDAParsed {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(raw, 'text/xml');
  const sections = xmlDoc.getElementsByTagName('section');
  const hpi = [...(sections as unknown as HTMLElement[])]
    ?.filter(
      (s) =>
        s.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ===
        CCDAStructureDefinition.HPI
    )?.[0]
    ?.getElementsByTagName('content');
  const hpiInnerHtml = hpi
    ? [...(hpi as unknown as HTMLElement[])]?.map((x) => x.innerHTML)
    : '';

  const vitalSigns = [...(sections as unknown as HTMLElement[])]
    ?.filter(
      (s) =>
        s.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ===
        CCDAStructureDefinition.VITAL_SIGNS
    )?.[0]
    ?.getElementsByTagName('content');
  const vsInnerHtml = vitalSigns
    ? [...(vitalSigns as unknown as HTMLElement[])]?.map((x) => x.innerHTML)
    : '';

  const parsedDoc = {
    hpi: hpiInnerHtml?.[0] || '',
    vitalSigns: vsInnerHtml?.[0] || '',
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
}: {
  item: ClinicalDocument<BundleEntry<DocumentReference>>;
}) {
  const cd = useConnectionDoc(item.source_record),
    [expanded, setExpanded] = useState(false),
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
    <>
      <div className="relative py-2">
        <div className="relative flex justify-center">
          <button
            type="button"
            className="focus:ring-primary-700 inline-flex items-center rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium leading-5 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
            onClick={toggleOpen}
          >
            <span>Open</span>
          </button>
        </div>
      </div>
      <Modal open={expanded} setOpen={setExpanded}>
        <div className="flex flex-col">
          <ModalHeader
            title={item.metadata?.display_name || ''}
            setClose={toggleOpen}
          />
          <div className="max-h-full  scroll-py-3 p-3">
            <div
              className={`${
                expanded ? '' : 'hidden'
              } rounded-lg border border-solid border-gray-200`}
            >
              <p className="text-md whitespace-wrap overflow-x-scroll  text-gray-900">
                {!ccda && 'Loading...'}
                {/* {xml} */}
                {ccda?.vitalSigns && (
                  <div className="p-4">
                    <p className="w-full rounded-md bg-gray-100 p-2 font-bold">
                      Vital Signs
                    </p>
                    <p
                      className="p-2"
                      dangerouslySetInnerHTML={{
                        __html: ccda?.vitalSigns || '',
                      }}
                    ></p>
                  </div>
                )}
                {ccda?.hpi && (
                  <div className="p-4">
                    <p className="w-full rounded-md bg-gray-100 p-2 font-bold">
                      History of Present Illness
                    </p>
                    <p
                      className="p-2"
                      dangerouslySetInnerHTML={{ __html: ccda?.hpi || '' }}
                    ></p>
                  </div>
                )}
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
