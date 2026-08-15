import { BundleEntry, Device } from 'fhir/r4';
import { formatTime } from '../../../../shared/utils/dateFormatters';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../../../connections/hooks/useConnectionDoc';
import { SkeletonLoadingText } from '../skeletons/SkeletonLoadingText';
import { CardBase } from '../../../connections/components/CardBase';
import { TimelineCardTitle } from '../TimelineCardTitle';
import { memo } from 'react';
import { TimelineCardCategoryTitle } from '../TimelineCardCategoryTitle';

export const DeviceCard = memo(function DeviceCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Device>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);

  return (
    <CardBase>
      <div className="min-w-0 flex-1">
        <TimelineCardCategoryTitle title="Device" color="text-teal-600" />

        <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
        <p className="truncate text-xs font-medium text-gray-800 md:text-sm">
          {formatTime(item.metadata?.date)}
        </p>
        {item.data_record.raw.resource?.manufacturer ? (
          <p className="truncate text-xs font-medium text-gray-800 md:text-sm">
            {item.data_record.raw.resource.manufacturer}
          </p>
        ) : null}
        {conn?.get('name') ? (
          <p className="truncate text-xs font-medium text-gray-700 md:text-sm">
            {conn?.get('name')}
          </p>
        ) : (
          <SkeletonLoadingText />
        )}
      </div>
    </CardBase>
  );
});
