import { memo } from 'react';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { ObservationCard } from '../../../components/timeline/ObservationCard';
import { DiagnosticReportCard } from '../../../components/timeline/DiagnosticReportCard';
import { MedicationCard } from '../../../components/timeline/MedicationCard';
import { DocumentReferenceCard } from '../../../components/timeline/DocumentReferenceCard';
import { ConditionCard } from '../../../components/timeline/ConditionCard';
import { ImmunizationCard } from '../../../components/timeline/ImmunizationCard';
import { ProcedureCard } from '../../../components/timeline/ProcedureCard';
import { EncounterCard } from '../../../components/timeline/EncounterCard';
import { RENDERABLE_RESOURCE_TYPES } from '../constants/renderableTypes';

interface SourceDocumentsDisplayProps {
  sourceDocs: ClinicalDocument<BundleEntry<FhirResource>>[];
  isCollapsed?: boolean;
}

export const SourceDocumentsDisplay = memo(function SourceDocumentsDisplay({
  sourceDocs,
  isCollapsed = false,
}: SourceDocumentsDisplayProps) {
  console.log(
    `[SourceDocumentsDisplay] Rendering with:`,
    {
      sourceDocsReceived: sourceDocs?.length || 0,
      isCollapsed,
      docTypes: sourceDocs?.map(d => d.data_record?.raw?.resource?.resourceType).slice(0, 5)
    }
  );
  
  if (!sourceDocs || sourceDocs.length === 0) {
    console.log(`[SourceDocumentsDisplay] No source docs, returning null`);
    return null;
  }

  // Check if a document has a renderable card
  const hasRenderableCard = (
    item: ClinicalDocument<BundleEntry<FhirResource>>,
  ) => {
    const resourceType = item.data_record?.raw?.resource?.resourceType;
    return RENDERABLE_RESOURCE_TYPES.includes(resourceType as any);
  };

  // Filter out documents without renderable cards
  const renderableDocs = sourceDocs.filter(hasRenderableCard);
  
  console.log(
    `[SourceDocumentsDisplay] Filtered to ${renderableDocs.length} renderable docs from ${sourceDocs.length} total`,
    {
      renderableTypes: renderableDocs.map(d => d.data_record?.raw?.resource?.resourceType).slice(0, 5),
      nonRenderableTypes: sourceDocs
        .filter(d => !hasRenderableCard(d))
        .map(d => d.data_record?.raw?.resource?.resourceType)
        .slice(0, 5)
    }
  );

  if (renderableDocs.length === 0) {
    return null;
  }

  // Group documents by resource type for better organization
  const groupedDocs = renderableDocs.reduce(
    (acc, doc) => {
      const resourceType =
        doc.data_record.raw.resource?.resourceType || 'Unknown';
      if (!acc[resourceType]) {
        acc[resourceType] = [];
      }
      acc[resourceType].push(doc);
      return acc;
    },
    {} as Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>,
  );

  const renderCard = (item: ClinicalDocument<BundleEntry<FhirResource>>) => {
    const resourceType = item.data_record.raw.resource?.resourceType;

    switch (resourceType) {
      case 'Observation':
        return <ObservationCard key={item.id} item={item as any} />;
      case 'DiagnosticReport':
        return <DiagnosticReportCard key={item.id} item={item as any} />;
      case 'MedicationStatement':
        return <MedicationCard key={item.id} item={item as any} />;
      case 'DocumentReference':
        return <DocumentReferenceCard key={item.id} item={item as any} />;
      case 'Condition':
        return <ConditionCard key={item.id} item={item as any} />;
      case 'Immunization':
        return <ImmunizationCard key={item.id} item={item as any} />;
      case 'Procedure':
        return <ProcedureCard key={item.id} item={item as any} />;
      case 'Encounter':
        return <EncounterCard key={item.id} item={item as any} />;
      default:
        return null;
    }
  };

  if (isCollapsed) {
    return (
      <div className="mt-2 text-xs text-gray-500">
        📋 {renderableDocs.length} medical records used
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-md p-3">
      <div className="text-sm font-medium text-gray-700 mb-3">
        📋 Medical Records Used ({renderableDocs.length})
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {Object.entries(groupedDocs).map(([resourceType, docs]) => (
          <div key={resourceType}>
            <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wider">
              {resourceType} ({docs.length})
            </div>
            <div className="space-y-2 mx-2">{docs.map(renderCard)}</div>
          </div>
        ))}
      </div>
    </div>
  );
});
