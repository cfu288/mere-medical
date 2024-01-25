import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { flattenObject } from '../../../../utils/flattenObject';
import { DocMeta } from '../providers/VectorStorageProvider';
import { MAX_CHARS, CHUNK_SIZE, CHUNK_OVERLAP } from '../constants';

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
  const docList: {
    id: string;
    text: string;
    chunk?: { offset: number; size: number };
  }[] = [];
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
    chunkXmlContent(
      document.data_record.raw as string,
      meta,
      docId,
      docList,
      metaList,
    );
  }

  return { docList, metaList };
}

function chunkXmlContent(
  content: string,
  meta: DocMeta,
  documentId: string,
  chunkedDocumentsList: Array<{
    id: string;
    text: string;
    chunk?: { offset: number; size: number };
  }>,
  chunkedMetadataList: Array<DocMeta>,
) {
  if (content.length > CHUNK_SIZE) {
    for (
      let offset = 0, chunkId = 0;
      offset < content.length;
      offset += CHUNK_SIZE - CHUNK_OVERLAP, chunkId++
    ) {
      const chunkData = content.substring(
        offset,
        Math.min(offset + CHUNK_SIZE, content.length),
      );
      chunkedDocumentsList.push({
        id: `${documentId}_chunk${chunkId}`,
        text: chunkData,
        chunk: {
          offset: offset,
          size: chunkData.length,
        },
      });
      chunkedMetadataList.push(meta);
    }
  } else {
    chunkedDocumentsList.push({ id: documentId, text: content });
    chunkedMetadataList.push(meta);
  }
}
