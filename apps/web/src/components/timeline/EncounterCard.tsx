import { BundleEntry, Encounter } from 'fhir/r2';
import { formatTime } from '../../utils/dateFormatters';
import { BundleEntry as R4BundleEntry, Encounter as R4Encounter } from 'fhir/r4';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { TimelineCardTitle } from './TimelineCardTitle';
import { memo, useState } from 'react';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { CardBase } from '../connection/CardBase';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { TimelineCardSubtitile } from './TimelineCardSubtitile';
import {
  getEncounterClass,
  getEncounterLocation,
} from '../../utils/fhirAccessHelpers';
import { OpenableCardIcon } from './OpenableCardIcon';
import { ShowEncounterDetailsExpandable } from './ShowEncounterDetailsExpandable';

export const EncounterCard = memo(function EncounterCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Encounter> | R4BundleEntry<R4Encounter>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <CardBase
        isFocusable
        onClick={() => {
          setExpanded((x) => !x);
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="items-top flex justify-between">
            <TimelineCardCategoryTitle title="Encounter" color="text-red-500" />
            <OpenableCardIcon />
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
            {formatTime(item.metadata?.date)}
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
      <ShowEncounterDetailsExpandable
        item={item}
        expanded={expanded}
        setExpanded={setExpanded}
      />
    </>
  );
});
