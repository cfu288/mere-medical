import { BundleEntry, DocumentReference } from 'fhir/r2';
import { useEffect, useState } from 'react';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { Modal } from '../../Modal';
import { ModalHeader } from '../../ModalHeader';
import { useClinicalDoc } from '../../hooks/useClinicalDoc';
import { useConnectionDoc } from '../../hooks/useConnectionDoc';
import { CCDAStructureDefinitionKeys2_1 } from './CCDAStructureDefinitionKeys2_1';
import { DisplayCCDADocument } from './DisplayCCDADocument';
import { parseCCDA } from './parseCCDA/parseCCDA';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { format, parseISO } from 'date-fns';

export const LOINC_CODE_SYSTEM = '2.16.840.1.113883.6.1';

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
      | Partial<Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>>
      | undefined
    >(undefined),
    attachmentUrl = item.data_record.raw.resource?.content?.[0].attachment.url,
    attachment = useClinicalDoc(attachmentUrl),
    [hasLoadedDocument, setHasLoadedDocument] = useState(false);
  const id = item.metadata?.id || item.id;
  useEffect(() => {
    if (expanded) {
      if (
        attachment?.get('data_record.content_type') === 'application/xml' &&
        checkIfXmlIsCCDA(attachment.get('data_record.raw'))
      ) {
        const parsedDoc = parseCCDA(attachment.get('data_record.raw'));
        setHasLoadedDocument(true);
        setCCDA(parsedDoc);
      } else {
        setHasLoadedDocument(true);
      }
    }
  }, [expanded, cd, attachment]);

  return (
    <motion.div className="relative z-30">
      {/* Background opacity */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-gray-500 bg-opacity-50 transition-opacity"
      />
      {/* Modal */}
      <motion.div
        layout
        className="fixed inset-0 z-10 flex flex-col overflow-y-auto pt-12 sm:p-12"
      >
        <motion.div
          layoutId={`card-base-${id}`}
          className="mx-auto w-screen rounded-xl border bg-white shadow-2xl sm:w-auto sm:min-w-[50%] sm:max-w-3xl"
        >
          <motion.div className="flex flex-col ">
            <motion.div className="flex w-full flex-col p-4 pb-2">
              <motion.div className="flex justify-between">
                <motion.p
                  layoutId={`card-title-${id}`}
                  className="w-full text-xl font-bold"
                >
                  {item.metadata?.display_name
                    ?.replace(/- final result/gi, '')
                    .replace(/- final/gi, '')}
                </motion.p>
                <motion.button
                  type="button"
                  layoutId={`card-close-${id}`}
                  className="ml-4 rounded bg-white text-gray-500 duration-75 hover:text-gray-700 focus:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-90 active:bg-slate-50"
                  onClick={() => setExpanded(false)}
                >
                  <motion.span className="sr-only">Close</motion.span>
                  <XMarkIcon className="h-8 w-8" aria-hidden="true" />
                </motion.button>
              </motion.div>
              <motion.div
                layoutId={`card-subtitle-${id}`}
                className="text-sm font-light"
              >
                {format(parseISO(item.metadata?.date || ''), 'LLLL do yyyy')}
              </motion.div>
              <motion.div
                layoutId={`card-content-${id}`}
                className="max-h-full scroll-py-3 p-3"
              >
                <div
                  className={`${
                    expanded ? '' : 'hidden'
                  } rounded-lg border border-solid border-gray-200`}
                >
                  <p className="text-md whitespace-wrap overflow-x-scroll p-4 text-gray-900">
                    {!hasLoadedDocument && 'Loading...'}
                    <DisplayCCDADocument ccda={ccda} />
                    {hasLoadedDocument && !ccda && (
                      <p>
                        Sorry, looks like we were unable to get the linked
                        document
                      </p>
                    )}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
