import { format, parseISO } from 'date-fns';
import { BundleEntry, Immunization } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { CardBase } from '../connection/CardBase';
import { TimelineCardTitle } from './TimelineCardTitle';
import { memo } from 'react';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { TimelineCardSubtitile } from './TimelineCardSubtitile';

export const ImmunizationCard = memo(function ImmunizationCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Immunization>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);

  return (
    <CardBase>
      <div className="min-w-0 flex-1">
        <TimelineCardCategoryTitle
          title="Immunization"
          color="text-purple-600"
        />

        <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
        <p className="truncate text-xs font-medium text-gray-500 md:text-sm">
          {item.metadata?.date ? format(parseISO(item.metadata.date), 'p') : ''}
        </p>
        {conn?.get('name') ? (
          <TimelineCardSubtitile variant="light">
            {conn?.get('name')}
          </TimelineCardSubtitile>
        ) : (
          <SkeletonLoadingText />
        )}
      </div>
    </CardBase>
  );
});
