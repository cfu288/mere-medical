import { useEffect, useState } from 'react';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { Modal } from '../../Modal';
import { ModalHeader } from '../../ModalHeader';
import { useConnectionDoc } from '../../hooks/useConnectionDoc';
import { CCDAStructureDefinitionKeys2_1 } from './CCDAStructureDefinitionKeys2_1';
import { DisplayCCDADocument } from './DisplayCCDADocument';
import { parseCCDA } from './parseCCDA/parseCCDA';

export const LOINC_CODE_SYSTEM = '2.16.840.1.113883.6.1';
export const SNOMED_CT_CODE_SYSTEM = '2.16.840.1.113883.6.96';

export function checkIfXmlIsCCDA(xml: string): boolean {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('ClinicalDocument');
    return sections.length > 0;
  } catch (e) {
    return false;
  }
}

export function ShowDocumentResultsAttachmentExpandable({
  item,
  expanded,
  setExpanded,
}: {
  item: ClinicalDocument<string>; //xml string
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const cd = useConnectionDoc(item.connection_record_id),
    [ccda, setCCDA] = useState<
      | Partial<Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>>
      | undefined
    >(undefined),
    // attachmentUrl = item.data_record.raw.resource?.content?.[0].attachment.url,
    // attachment = useClinicalDoc(attachmentUrl),
    [hasLoadedDocument, setHasLoadedDocument] = useState(false);

  useEffect(() => {
    if (expanded) {
      if (
        item.data_record.content_type === 'application/xml' &&
        checkIfXmlIsCCDA(item.data_record.raw)
      ) {
        const parsedDoc = parseCCDA(item.data_record.raw);
        setHasLoadedDocument(true);
        setCCDA(parsedDoc);
      } else {
        setHasLoadedDocument(true);
      }
    }
  }, [expanded, cd, item.data_record.content_type, item.data_record.raw]);

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
              {!hasLoadedDocument && 'Loading...'}
              <DisplayCCDADocument ccda={ccda} />
              {hasLoadedDocument && !ccda && (
                <p>
                  Sorry, looks like we were unable to get the linked document
                </p>
              )}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
