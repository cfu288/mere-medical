import { format, parseISO } from 'date-fns';
import { BundleEntry, Encounter } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { TimelineCardTitle } from './TimelineCardTitle';
import { memo, useState } from 'react';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { CardBase } from '../connection/CardBase';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { TimelineCardSubtitile } from './TimelineCardSubtitile';

export const EncounterCard = memo(function EncounterCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Encounter>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);

  return (
    <CardBase>
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
        <TimelineCardSubtitile variant="dark">
          {item.metadata?.date ? format(parseISO(item.metadata.date), 'p') : ''}
        </TimelineCardSubtitile>
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
