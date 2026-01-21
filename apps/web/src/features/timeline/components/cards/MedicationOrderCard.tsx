import { BundleEntry, MedicationOrder } from 'fhir/r2';
import { formatTime } from '../../../../shared/utils/dateFormatters';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../../../connections/hooks/useConnectionDoc';
import { SkeletonLoadingText } from '../skeletons/SkeletonLoadingText';
import { CardBase } from '../../../connections/components/CardBase';
import { TimelineCardTitle } from '../TimelineCardTitle';
import { memo } from 'react';
import { TimelineCardCategoryTitle } from '../TimelineCardCategoryTitle';

export const MedicationOrderCard = memo(function MedicationOrderCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<MedicationOrder>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);
  const resource = item.data_record.raw.resource;
  const displayName =
    resource?.medicationCodeableConcept?.text ||
    resource?.medicationCodeableConcept?.coding?.[0]?.display ||
    item.metadata?.display_name;

  return (
    <CardBase>
      <div className="min-w-0 flex-1">
        <TimelineCardCategoryTitle
          title="Prescription"
          color="text-fuchsia-600"
        />

        <TimelineCardTitle>{displayName}</TimelineCardTitle>
        <p className="truncate text-xs font-medium text-gray-800 md:text-sm">
          {formatTime(item.metadata?.date)}
        </p>
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
