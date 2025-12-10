import { BundleEntry, Goal } from 'fhir/r4';
import { formatTime } from '../../../../shared/utils/dateFormatters';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../../../connections/hooks/useConnectionDoc';
import { SkeletonLoadingText } from '../skeletons/SkeletonLoadingText';
import { CardBase } from '../../../connections/components/CardBase';
import { TimelineCardTitle } from '../TimelineCardTitle';
import { memo, useState } from 'react';
import { TimelineCardCategoryTitle } from '../TimelineCardCategoryTitle';
import { OpenableCardIcon } from '../OpenableCardIcon';
import { ShowGoalDetailsExpandable } from '../expandables/ShowGoalDetailsExpandable';

export const GoalCard = memo(function GoalCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Goal>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);
  const [expanded, setExpanded] = useState(false);
  const goal = item.data_record.raw.resource;

  const statusColorMap: Record<string, string> = {
    achieved: 'text-green-600',
    'in-progress': 'text-blue-600',
    'on-hold': 'text-yellow-600',
    cancelled: 'text-red-600',
    proposed: 'text-gray-600',
    planned: 'text-purple-600',
    accepted: 'text-teal-600',
  };

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
            <TimelineCardCategoryTitle title="Goal" color="text-emerald-600" />
            <OpenableCardIcon />
          </div>

          <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
          <p className="truncate text-xs font-medium text-gray-800 md:text-sm">
            {formatTime(item.metadata?.date)}
          </p>
          {goal?.lifecycleStatus && (
            <p
              className={`truncate text-xs font-medium md:text-sm capitalize ${statusColorMap[goal.lifecycleStatus] || 'text-gray-600'}`}
            >
              {goal.lifecycleStatus.replace('-', ' ')}
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
      <ShowGoalDetailsExpandable
        item={item}
        expanded={expanded}
        setExpanded={setExpanded}
      />
    </>
  );
});
