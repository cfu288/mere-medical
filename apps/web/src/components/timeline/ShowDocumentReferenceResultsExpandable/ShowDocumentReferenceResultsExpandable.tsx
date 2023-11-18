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
import { MotionModal } from '../MotionModal/MotionModal';
import { MotionModalCategoryTitle } from '../MotionModal/MotionModalCategoryTitle';
import { MotionModalCloseButton } from '../MotionModal/MotionModalCloseButton';
import { MotionModalSubtitle } from '../MotionModal/MotionModalSubtitle';
import { MotionModalTitle } from '../MotionModal/MotionModalTitle';

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
    <MotionModal id={id}>
      <motion.div className="flex w-full flex-col p-4 pb-2">
        <MotionModalCategoryTitle id={id}>
          <p className="mr-1 w-12"></p>
        </MotionModalCategoryTitle>
        <motion.div className="flex justify-between">
          <MotionModalTitle id={id}>
            {item.metadata?.display_name
              ?.replace(/- final result/gi, '')
              .replace(/- final/gi, '')}
          </MotionModalTitle>
          <MotionModalCloseButton id={id} setExpanded={setExpanded} />
        </motion.div>
        <div className="flex flex-col">
          <MotionModalSubtitle id={id}>
            {format(parseISO(item.metadata?.date || ''), 'LLLL do yyyy')}
          </MotionModalSubtitle>
          <motion.div className="max-h-full scroll-py-3 p-3">
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
                    Sorry, looks like we were unable to get the linked document
                  </p>
                )}
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </MotionModal>
  );
}
