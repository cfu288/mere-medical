import { BundleEntry, DiagnosticReport, FhirResource } from 'fhir/r2';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../components/providers/DatabaseCollections';
import { prepareClinicalDocumentForVectorization } from '../../../components/providers/vector-provider/helpers/prepareClinicalDocumentForVectorization';
import { getRelatedDocuments } from '../../../components/timeline/DiagnosticReportCard';
import { getRelatedLoincLabs } from '../../../components/timeline/ObservationResultRow';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../../../models/user-document/UserDocument.type';

export const prepareDataForOpenAI = async ({
  data,
  db,
  user,
  idsOfMostRelatedChunksFromSemanticSearch,
  softLimit = 150,
}: {
  data: ClinicalDocument<BundleEntry<FhirResource>>[];
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
  idsOfMostRelatedChunksFromSemanticSearch: string[];
  softLimit?: number;
}) => {
  const dataAsSet: Set<string> = new Set();

  for (const item of data) {
    const chunkedClinicalDocsList =
      prepareClinicalDocumentForVectorization(item).docList;

    const chunkedCliicalDocsContainsAtLeastOneChunk =
      chunkedClinicalDocsList.some((i) => i.chunk);

    if (!chunkedCliicalDocsContainsAtLeastOneChunk) {
      const texts = chunkedClinicalDocsList.map((i) => i.text);
      texts.forEach((t) => dataAsSet.add(t));
    } else {
      // chunkedClinicalDocsList contains many chunks, but we only want to pull the ones that are relevant
      // The relevant ones are the ones that have an id inside chunkMetadata
      const relevantChunks = chunkedClinicalDocsList.filter(
        (clinicalDocsChunk) => {
          const chunkWithSameId = idsOfMostRelatedChunksFromSemanticSearch.find(
            (metaChunkId) => metaChunkId === clinicalDocsChunk.id,
          );
          return chunkWithSameId !== undefined;
        },
      );
      const texts = relevantChunks.map((i) => i.text);
      texts.forEach((t) => dataAsSet.add(t));
    }

    if (item.data_record.raw.resource?.resourceType === 'Observation') {
      const loinc = item.metadata?.loinc_coding || [];
      // To help the AI understand the trend of an observation, we can get the
      // last 5 related labs with the same LOINC code and add them to the context
      const relatedDocs = await getRelatedLoincLabs({
        loinc,
        db,
        user,
        limit: 3,
      });
      const relatedList = relatedDocs.flatMap(
        (i) => prepareClinicalDocumentForVectorization(i).docList,
      );
      relatedList.forEach((i) => dataAsSet.add(i.text));
    } else if (
      item.data_record.raw.resource?.resourceType === 'DiagnosticReport'
    ) {
      // A DiagnosticReport is a summary of a bunch of Observations
      // So we can get the related Observations from the DiagnosticReport
      const relatedDocsAndAbnormalIndicators = await getRelatedDocuments({
        db,
        user,
        item: item as ClinicalDocument<BundleEntry<DiagnosticReport>>,
      });
      const relatedDocs = relatedDocsAndAbnormalIndicators[0];
      const relatedList = relatedDocs.flatMap(
        (i) => prepareClinicalDocumentForVectorization(i).docList,
      );
      relatedList.forEach((i) => dataAsSet.add(i.text));
    }
    // Prevent context from getting too large
    if (dataAsSet.size >= softLimit) {
      // trim the set to 100
      break;
    }
  }

  return [...dataAsSet];
};
