import { BundleEntry, CareTeam } from 'fhir/r4';
import { formatTime } from '../../../../shared/utils/dateFormatters';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../../../connections/hooks/useConnectionDoc';
import { SkeletonLoadingText } from '../skeletons/SkeletonLoadingText';
import { CardBase } from '../../../connections/components/CardBase';
import { TimelineCardTitle } from '../TimelineCardTitle';
import { memo, useState } from 'react';
import { TimelineCardCategoryTitle } from '../TimelineCardCategoryTitle';
import { OpenableCardIcon } from '../OpenableCardIcon';
import { ShowCareTeamDetailsExpandable } from '../expandables/ShowCareTeamDetailsExpandable';

export const CareTeamCard = memo(function CareTeamCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<CareTeam>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);
  const [expanded, setExpanded] = useState(false);
  const careTeam = item.data_record.raw.resource;

  const participantCount = careTeam?.participant?.length || 0;

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
            <TimelineCardCategoryTitle
              title="Care Team"
              color="text-cyan-600"
            />
            <OpenableCardIcon />
          </div>

          <TimelineCardTitle>
            {item.metadata?.display_name || careTeam?.name}
          </TimelineCardTitle>
          <p className="truncate text-xs font-medium text-gray-800 md:text-sm">
            {formatTime(item.metadata?.date)}
          </p>
          {participantCount > 0 && (
            <p className="truncate text-xs font-medium text-gray-600 md:text-sm">
              {participantCount} participant{participantCount !== 1 ? 's' : ''}
            </p>
          )}
          {conn?.get('name') ? (
            <p className="truncate text-xs font-medium text-gray-700 md:text-sm">
              {conn?.get('name')}
            </p>
          ) : (
            <SkeletonLoadingText />
          )}
        </div>
      </CardBase>
      <ShowCareTeamDetailsExpandable
        item={item}
        expanded={expanded}
        setExpanded={setExpanded}
      />
    </>
  );
});
