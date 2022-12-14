import { BundleEntry, DocumentReference, Observation } from 'fhir/r2';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { RxDocument } from 'rxdb';
import { ClinicalDocument } from '../models/ClinicalDocument';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { Modal } from './Modal';
import { ModalHeader } from './ModalHeader';
import { useRxDb } from './RxDbProvider';
import { useConnectionDoc } from './Timeline/useConnectionDoc';

async function fetchData(url: string, cd: RxDocument<ConnectionDocument>) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cd.get('access_token')}`,
    },
  });
  const contentType = res.headers.get('Content-Type');
  let raw = undefined;
  if (contentType === 'application/xml') {
    raw = await res.text();
  }

  return { contentType, raw };
}

export function ShowDocumentResultsExpandable({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DocumentReference>>;
}) {
  const db = useRxDb(),
    cd = useConnectionDoc(item.source_record),
    [expanded, setExpanded] = useState(false),
    [xml, setXml] = useState<string | undefined>(undefined),
    [contentType, setContentType] = useState<string | null>(null),
    toggleOpen = () => setExpanded((x) => !x),
    attachmentUrl = item.data_record.raw.resource?.content?.[0].attachment.url;

  useEffect(() => {
    if (expanded) {
      if (attachmentUrl && cd) {
        fetchData(attachmentUrl, cd).then(({ contentType, raw }) => {
          setContentType(contentType);
          const parser = new DOMParser();
          setXml(raw);
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
              <p className="text-md whitespace-wrap overflow-x-scroll font-bold text-gray-900">
                {!xml && 'Loading...'}
                {xml && xml.replace(/\s+/g, '')}
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
