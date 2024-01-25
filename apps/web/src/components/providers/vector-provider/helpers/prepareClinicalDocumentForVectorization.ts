import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { flattenObject } from '../../../../utils/flattenObject';
import { DocMeta } from '../providers/VectorStorageProvider';
import { MAX_CHARS, CHUNK_SIZE } from '../constants';

/**
 * For each clinical document, prepare the document for vectorization
 * If a document is JSON, flatten the object, take the values only and
 * serialize it to a string. The string is then truncated to MAX_CHARS
 * If the document is XML, it is chunked into CHUNK_SIZE chunks and each
 * chunk is vectorized separately.
 *
 * @param document
 * @returns
 */

export function prepareClinicalDocumentForVectorization(
  document: ClinicalDocument<unknown>,
) {
  // need to maintain lists since documents can be chunked into multiple documents
  const docList: { id: string; text: string }[] = Array<{
    id: string;
    text: string;
  }>();
  const metaList: DocMeta[] = Array<DocMeta>();

  const docId = document.id!;
  const meta = {
    category: document.data_record.resource_type,
    document_type: 'clinical_document',
    id: docId,
    url: document.metadata?.id!,
  };

  if (document.data_record.content_type === 'application/json') {
    const newUnflatObject: any = document.data_record.raw;
    delete newUnflatObject.link;
    delete newUnflatObject.fullUrl;
    delete newUnflatObject.search;
    delete newUnflatObject.resource.subject;
    delete newUnflatObject.resource.id;
    delete newUnflatObject.resource.status;
    delete newUnflatObject.resource.identifier;
    const newFlatObject = flattenObject(
      Object.keys(newUnflatObject)
        .sort()
        .reduce((obj: any, key: any) => {
          obj[key] = newUnflatObject[key];
          return obj;
        }, {}),
    );
    const serialzed = [...new Set(Object.values(newFlatObject))]
      .join('|')
      .substring(0, MAX_CHARS);
    docList.push({ id: docId, text: serialzed });
    metaList.push(meta);
  } else if (document.data_record.content_type === 'application/xml') {
    const contentFull = document.data_record.raw as string;
    if (contentFull.length > CHUNK_SIZE) {
      for (let offset = 0; offset < contentFull.length; offset += CHUNK_SIZE) {
        const chunk = contentFull.substring(
          offset,
          Math.min(offset + CHUNK_SIZE, contentFull.length),
        );
        docList.push({ id: `${docId}_chunk${offset}`, text: chunk });
        metaList.push(meta);
      }
    } else {
      // docList.push({ id: docId, text: contentFull });
      // metaList.push(meta);
    }
  }

  return { docList, metaList };
}
