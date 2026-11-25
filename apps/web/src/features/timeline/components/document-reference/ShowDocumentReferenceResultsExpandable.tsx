import { BundleEntry, DocumentReference } from 'fhir/r2';
import { useEffect, useState, type JSX } from 'react';
import DOMPurify from 'dompurify';
import parse from 'html-react-parser';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { Modal } from '../../../../shared/components/Modal';
import { ModalHeader } from '../../../../shared/components/ModalHeader';
import { useClinicalDoc } from '../../../../shared/hooks/useClinicalDoc';
import { useConnectionDoc } from '../../../connections/hooks/useConnectionDoc';
import { CCDAStructureDefinitionKeys2_1 } from './CCDAStructureDefinitionKeys2_1';
import { DisplayCCDADocument } from './DisplayCCDADocument';
import { checkIfXmlIsCCDA, parseCCDA } from './parseCCDA/parseCCDA';

export const LOINC_CODE_SYSTEM = '2.16.840.1.113883.6.1';
export const SNOMED_CT_CODE_SYSTEM = '2.16.840.1.113883.6.96';

type DocumentView =
  // becomes one of the others when the document has been found or not
  | { status: 'loading' }
  | {
      status: 'ccda';
      ccda: Partial<
        Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>
      >;
    }
  | { status: 'pdf'; url: string }
  // also used for plain text
  | { status: 'html'; html: string | JSX.Element | JSX.Element[] }
  // we couldn't find or show the document
  | { status: 'missing' };

/**
 * Works out how to show a document. Call URL.revokeObjectURL on the url of a
 * pdf when it is no longer shown.
 */
function toDocumentView(
  attachment: ClinicalDocument | null | undefined,
  attachmentUrl: string | undefined,
): DocumentView {
  if (!attachment) {
    console.error(
      '[ShowDocumentResultsExpandable] No attachment found in DB for URL:',
      attachmentUrl,
    );
    return { status: 'missing' };
  }
  const { content_type, raw } = attachment.data_record;
  if (
    content_type?.includes('application/xml') &&
    checkIfXmlIsCCDA(raw as string)
  ) {
    return { status: 'ccda', ccda: parseCCDA(raw as string) };
  }
  if (content_type?.includes('application/pdf') && typeof raw === 'string') {
    try {
      const byteCharacters = atob(raw);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      return { status: 'pdf', url: URL.createObjectURL(blob) };
    } catch (error) {
      console.error(
        '[ShowDocumentResultsExpandable] Error converting base64 to Blob:',
        error,
      );
      return { status: 'missing' };
    }
  }
  if (content_type?.includes('text/html') && typeof raw === 'string') {
    return { status: 'html', html: parse(DOMPurify.sanitize(raw)) };
  }
  if (content_type?.includes('text/plain') && typeof raw === 'string') {
    return {
      status: 'html',
      html: <pre className="whitespace-pre-wrap">{raw}</pre>,
    };
  }
  console.error(
    '[ShowDocumentResultsExpandable] Attachment exists but cannot be displayed:',
    {
      contentType: content_type,
      hasRaw: !!raw,
      rawType: typeof raw,
      rawValue: raw,
    },
  );
  return { status: 'missing' };
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
    attachmentUrl =
      item.data_record.raw.resource?.content?.[0]?.attachment?.url,
    // Url-fetched attachments are stored under their url, inline
    // Attachment.data content under `{DocumentReference metadata.id}/attachment`
    attachmentId =
      attachmentUrl ||
      (item.metadata?.id ? `${item.metadata.id}/attachment` : undefined),
    attachment = useClinicalDoc(item.connection_record_id, attachmentId),
    [view, setView] = useState<DocumentView>({ status: 'loading' });

  useEffect(() => {
    if (!expanded) return;
    // we are still looking for the document
    if (attachment === undefined && attachmentId) return;
    const next = toDocumentView(attachment, attachmentUrl);
    setView(next);
    return () => {
      if (next.status === 'pdf') {
        URL.revokeObjectURL(next.url);
      }
    };
  }, [expanded, cd, attachment, attachmentId, attachmentUrl]);

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
            } rounded-lg border border-solid border-gray-200 dark:border-gray-700`}
          >
            {view.status === 'loading' && (
              <p className="text-md p-4 text-gray-900 dark:text-gray-100">
                Loading...
              </p>
            )}

            {/* Display CCDA Document */}
            {view.status === 'ccda' && (
              <div className="text-md whitespace-wrap overflow-x-scroll p-4 text-gray-900 dark:text-gray-100">
                <DisplayCCDADocument ccda={view.ccda} />
              </div>
            )}

            {/* Display PDF Document */}
            {view.status === 'pdf' && (
              <div className="h-[600px] w-full p-4">
                <iframe
                  src={view.url}
                  className="h-full w-full border-0"
                  title={item.metadata?.display_name || 'PDF Document'}
                />
              </div>
            )}

            {/* Display HTML Document */}
            {view.status === 'html' && (
              <div className="prose prose-sm dark:prose-invert overflow-x-auto p-4">
                {view.html}
              </div>
            )}

            {/* Error message when document can't be displayed */}
            {view.status === 'missing' && (
              <p className="text-md p-4 text-gray-900 dark:text-gray-100">
                Sorry, looks like we were unable to get the linked document
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
