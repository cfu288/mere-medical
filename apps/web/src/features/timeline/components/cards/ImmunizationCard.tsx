import { BundleEntry, Immunization } from 'fhir/r2';
import { formatTime } from '../../../../shared/utils/dateFormatters';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../../../connections/hooks/useConnectionDoc';
import { SkeletonLoadingText } from '../skeletons/SkeletonLoadingText';
import { CardBase } from '../../../connections/components/CardBase';
import { TimelineCardTitle } from '../TimelineCardTitle';
import { memo } from 'react';
import { TimelineCardCategoryTitle } from '../TimelineCardCategoryTitle';
import { TimelineCardSubtitile } from '../TimelineCardSubtitile';

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
        <p className="truncate text-xs font-medium text-gray-800 md:text-sm">
          {formatTime(item.metadata?.date)}
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
