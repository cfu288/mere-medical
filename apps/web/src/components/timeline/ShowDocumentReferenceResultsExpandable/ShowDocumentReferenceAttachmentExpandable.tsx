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
  matchedChunks,
  searchQuery,
}: {
  item: ClinicalDocument<string | Blob>; // Can be XML string or PDF Blob
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  matchedChunks?: { id: string; metadata?: any }[];
  searchQuery?: string;
}) {
  const cd = useConnectionDoc(item.connection_record_id),
    [ccda, setCCDA] = useState<
      | Partial<Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>>
      | undefined
    >(undefined),
    [hasLoadedDocument, setHasLoadedDocument] = useState(false),
    [pdfUrl, setPdfUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (expanded) {
      if (
        item.data_record.content_type === 'application/xml' &&
        typeof item.data_record.raw === 'string' &&
        checkIfXmlIsCCDA(item.data_record.raw)
      ) {
        const parsedDoc = parseCCDA(item.data_record.raw);
        setHasLoadedDocument(true);
        setCCDA(parsedDoc);
      } else if (
        item.data_record.content_type === 'application/pdf' &&
        typeof item.data_record.raw === 'string'
      ) {
        try {
          const base64 = item.data_record.raw;
          const byteCharacters = atob(base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
          setHasLoadedDocument(true);
        } catch (error) {
          console.error(
            '[ShowDocumentResultsAttachmentExpandable] Error converting base64 to Blob:',
            error,
          );
          setHasLoadedDocument(true);
        }
      } else {
        setHasLoadedDocument(true);
      }
    }

    // Cleanup blob URL on unmount
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [expanded, cd, item.data_record.content_type, item.data_record.raw]);

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || ''}
          setClose={() => setExpanded(false)}
        />
        <div className="max-h-full scroll-py-3 p-3">
          <div
            className={`${
              expanded ? '' : 'hidden'
            } rounded-lg border border-solid border-gray-200`}
          >
            {!hasLoadedDocument && (
              <p className="text-md p-4 text-gray-900">Loading...</p>
            )}

            {/* Display CCDA Document */}
            {ccda && (
              <div className="text-md whitespace-wrap overflow-x-scroll p-4 text-gray-900">
                <DisplayCCDADocument
                  ccda={ccda}
                  matchedChunks={matchedChunks}
                />
              </div>
            )}

            {/* Display PDF Document */}
            {pdfUrl && (
              <div className="h-[600px] w-full p-4">
                <iframe
                  src={pdfUrl}
                  className="h-full w-full border-0"
                  title={item.metadata?.display_name || 'PDF Document'}
                />
              </div>
            )}

            {/* Error message when document can't be displayed */}
            {hasLoadedDocument && !ccda && !pdfUrl && (
              <p className="text-md p-4 text-gray-900">
                Sorry, looks like we were unable to get the linked document
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
