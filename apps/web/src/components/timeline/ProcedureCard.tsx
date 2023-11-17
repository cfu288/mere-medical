import { format, parseISO } from 'date-fns';
import { BundleEntry, Procedure } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { CardBase } from '../CardBase';
import { TimelineCardTitle } from './TimelineCard/TimelineCardTitle';
import { memo } from 'react';
import { TimelineCardCategoryTitle } from './TimelineCard/TimelineCardCategoryTitle';

export const ProcedureCard = memo(function ProcedureCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Procedure>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);

  return (
    <CardBase>
      <div className="min-w-0 flex-1">
        <TimelineCardCategoryTitle title="Procedure" color="text-blue-600" />

        <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
        <p className="truncate text-xs font-medium text-gray-500 md:text-sm">
          {item.metadata?.date ? format(parseISO(item.metadata.date), 'p') : ''}
        </p>
        {conn?.get('name') ? (
          <p className="truncate text-xs font-medium text-gray-400 md:text-sm">
            {conn?.get('name')}
          </p>
        ) : (
          <SkeletonLoadingText />
        )}
      </div>
    </CardBase>
  );
});
