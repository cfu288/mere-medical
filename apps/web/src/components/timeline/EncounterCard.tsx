import { format, parseISO } from 'date-fns';
import { BundleEntry, Encounter } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { TimelineCardTitle } from './TimelineCardTitle';
import { memo, useState } from 'react';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { TimelineCardBase } from './TimelineCardBase';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';

export const EncounterCard = memo(function EncounterCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Encounter>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);

  return (
    <TimelineCardBase>
      <div className="min-w-0 flex-1">
        <div className="items-top flex justify-between">
          <TimelineCardCategoryTitle title="Encounter" color="text-red-500" />
        </div>
        <TimelineCardTitle>
          {
            <>
              <p className="capitalize">{`${item.data_record.raw.resource?.class} - `}</p>
              <p>
                {`${item.data_record.raw.resource?.location?.[0].location.display}`}
              </p>
            </>
          }
        </TimelineCardTitle>
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
    </TimelineCardBase>
  );
});
