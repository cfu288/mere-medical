import { format, parseISO } from 'date-fns';
import { BundleEntry, Encounter } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { TimelineCardTitle } from './TimelineCardTitle';
import { memo } from 'react';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { CardBase } from '../connection/CardBase';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { TimelineCardSubtitile } from './TimelineCardSubtitile';
import {
  getEncounterClass,
  getEncounterLocation,
} from '../../utils/fhirAccessHelpers';

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
              <p className="capitalize">{`${getEncounterClass(item)} - `}</p>
              <p>{`${getEncounterLocation(item)}`}</p>
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
