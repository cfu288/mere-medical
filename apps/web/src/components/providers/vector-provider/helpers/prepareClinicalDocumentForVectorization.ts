import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { flattenObject } from '../../../../utils/flattenObject';
import { DocMeta } from '../providers/VectorStorageProvider';
import { MAX_CHARS, CHUNK_SIZE, CHUNK_OVERLAP } from '../constants';
import { IVSChunkMeta } from '@mere/vector-storage';
import { checkIfXmlIsCCDA } from '../../../timeline/ShowDocumentReferenceResultsExpandable/ShowDocumentReferenceAttachmentExpandable';
import { parseCCDARaw } from '../../../timeline/ShowDocumentReferenceResultsExpandable/parseCCDA/parseCCDA';

/**
 * For each clinical document, prepare the document for vectorization
 *
 * If a document is JSON, flatten the object, take the values only and
 * serialize it to a string. The string is then truncated to MAX_CHARS
 *
 * If the document is XML, it is chunked into chunks of CHUNK_SIZE and each
 * chunk string is vectorized separately. There is an overlap of CHUNK_OVERLAP
 * between each chunk to ensure that information is not lost between chunks.
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
    chunk?: IVSChunkMeta;
  }[] = [];
  const metaList: DocMeta[] = Array<DocMeta>();
  const docId = document.id;
  const meta = {
    category: document.data_record.resource_type,
    document_type: 'clinical_document',
    id: docId,
    url: document.metadata?.id,
  };

  if (
    document.data_record.content_type === 'application/json' &&
    document.data_record.format === 'FHIR.DSTU2'
  ) {
    serializeAndChunkJSONForVectorization(
      document.data_record.raw,
      meta,
      docId,
      docList,
      metaList,
    );
  } else if (
    document.data_record.content_type === 'application/xml' &&
    checkIfXmlIsCCDA(document.data_record.raw as string)
  ) {
    serializeCCDADocumentForVectorization(
      document.data_record.raw as string,
      meta,
      docId,
      docList,
      metaList,
    );
  } else if (document.data_record.content_type === 'application/xml') {
    serializeAndChunkXmlContentForVectorization({
      content: document.data_record.raw as string,
      meta,
      documentId: docId,
      chunkedDocumentsList: docList,
      chunkedMetadataList: metaList,
    });
  }

  return { docList, metaList };
}

function serializeAndChunkJSONForVectorization(
  data: any,
  meta: DocMeta,
  docId: string,
  docList: {
    id: string;
    text: string;
    chunk?: IVSChunkMeta;
  }[],
  metaList: DocMeta[],
) {
  const newUnflatObject: any = data;
  delete newUnflatObject.link;
  delete newUnflatObject.fullUrl;
  delete newUnflatObject.search;
  delete newUnflatObject.resource.category;
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
}

/**
 * Chunk XML content into chunks of CHUNK_SIZE
 *
 * @param content the XML content
 * @param meta the metadata for the document
 * @param documentId the ID of the original document being chunked
 * @param chunkedDocumentsList list that chunks are added to
 * @param chunkedMetadataList list that metadata chunks are added to
 */
function serializeAndChunkXmlContentForVectorization({
  content,
  meta,
  documentId,
  chunkedDocumentsList,
  chunkedMetadataList,
  prependText = '',
}: {
  content: string;
  meta: DocMeta;
  documentId: string;
  chunkedDocumentsList: Array<{
    id: string;
    text: string;
    chunk?: IVSChunkMeta;
  }>;
  chunkedMetadataList: Array<DocMeta>;
  prependText?: string;
}) {
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
        text: prependText + chunkData,
        chunk: {
          offset: offset,
          size: chunkData.length,
        },
      });
      chunkedMetadataList.push(meta);
    }
  } else {
    chunkedDocumentsList.push({
      id: documentId,
      text: prependText + (content || '').trim(),
    });
    chunkedMetadataList.push(meta);
  }
}

function serializeCCDADocumentForVectorization(
  content: string,
  meta: DocMeta,
  documentId: string,
  chunkedDocumentsList: Array<{
    id: string;
    text: string;
    chunk?: IVSChunkMeta;
  }>,
  chunkedMetadataList: Array<DocMeta>,
) {
  const parsed = parseCCDARaw(content);
  // for each section, serialize and chunk
  Object.entries(parsed).forEach(([sectionType, data]) => {
    if (data) {
      serializeAndChunkXmlContentForVectorization({
        content: data,
        meta,
        documentId: documentId + sectionType,
        chunkedDocumentsList,
        chunkedMetadataList,
        prependText: sectionType + '|',
      });
    }
  });
}
