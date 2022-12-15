import { BundleEntry, DocumentReference, Observation } from 'fhir/r2';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { RxDocument } from 'rxdb';
import { ClinicalDocument } from '../models/ClinicalDocument';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { Modal } from './Modal';
import { ModalHeader } from './ModalHeader';
import { useRxDb } from './RxDbProvider';
import { useConnectionDoc } from './Timeline/useConnectionDoc';

enum CCDAStructureDefinition {
  VITAL_SIGNS = '2.16.840.1.113883.10.20.22.2.4',
  PATIENT_INSTRUCTIONS = '2.16.840.1.113883.10.20.22.2.45',
  HPI = '1.3.6.1.4.1.19376.1.5.3.1.3.4',
  PLAN_OF_TREATMENT = '2.16.840.1.113883.10.20.22.2.10',
  RESULTS = '2.16.840.1.113883.10.20.22.2.3',
  VISIT_DIAGNOSIS = '2.16.840.1.113883.10.20.22.2.8',
  CARE_TEAMS = '2.16.840.1.113883.10.20.22.2.500',
}

async function fetchData(url: string, cd: RxDocument<ConnectionDocument>) {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cd.get('access_token')}`,
      },
    });
    if (!res.ok) {
      throw new Error(
        'Could not get document as the user is unauthorized. Try logging in again.'
      );
    }
    const contentType = res.headers.get('Content-Type');
    let raw = undefined;
    if (contentType === 'application/xml') {
      raw = await res.text();
      // raw = raw.replace(/\s+/g, '');
    }

    return { contentType, raw };
  } catch (e) {
    throw new Error(
      'Could not get document as the user is unauthorized. Try logging in again.'
    );
  }
}

interface CCDAParsed {
  hpi: string;
  vitalSigns: string;
}

function parseCCDA(raw: string): CCDAParsed {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(raw, 'text/xml');
  const sections = xmlDoc.getElementsByTagName('section');
  console.log(sections);
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
  console.log(parsedDoc);
  return parsedDoc;
}

export function ShowDocumentResultsExpandable({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DocumentReference>>;
}) {
  const db = useRxDb(),
    cd = useConnectionDoc(item.source_record),
    [expanded, setExpanded] = useState(false),
    [ccda, setCCDA] = useState<CCDAParsed | undefined>(undefined),
    [contentType, setContentType] = useState<string | null>(null),
    toggleOpen = () => setExpanded((x) => !x),
    attachmentUrl = item.data_record.raw.resource?.content?.[0].attachment.url;

  useEffect(() => {
    if (expanded) {
      if (attachmentUrl && cd) {
        fetchData(attachmentUrl, cd)
          .then(({ contentType, raw }) => {
            setContentType(contentType);
            if (raw) {
              const parsedDoc = parseCCDA(raw);
              setCCDA(parsedDoc);
            }
          })
          .catch((e) => {
            setCCDA(e.message);
          });
      }
    }
  }, [expanded, attachmentUrl, cd]);

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
