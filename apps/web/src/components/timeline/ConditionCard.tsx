import { format, parseISO } from 'date-fns';
import { BundleEntry, Condition } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { CardBase } from '../connection/CardBase';
import { TimelineCardTitle } from './TimelineCardTitle';
import { memo } from 'react';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';

export const ConditionCard = memo(function ConditionCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Condition>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);

  return (
    <CardBase>
      <div className="min-w-0 flex-1">
        <TimelineCardCategoryTitle title="Condition" color="text-green-600" />

        <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
        <p className="truncate text-xs font-medium text-gray-700 md:text-sm">
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
