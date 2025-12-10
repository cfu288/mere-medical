import { BundleEntry, FhirResource } from 'fhir/r2';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { RENDERABLE_RESOURCE_TYPES } from '../constants/renderableTypes';

export function countRenderableDocuments(
  sourceDocs?: ClinicalDocument<BundleEntry<FhirResource>>[],
): number {
  if (!sourceDocs || sourceDocs.length === 0) {
    return 0;
  }

  return sourceDocs.filter((doc) => {
    const resourceType = doc.data_record?.raw?.resource?.resourceType;
    return (
      resourceType && RENDERABLE_RESOURCE_TYPES.includes(resourceType as any)
    );
  }).length;
}
