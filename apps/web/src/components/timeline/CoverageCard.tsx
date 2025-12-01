import { BundleEntry, Coverage } from 'fhir/r4';
import { formatTime } from '../../utils/dateFormatters';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { CardBase } from '../connection/CardBase';
import { TimelineCardTitle } from './TimelineCardTitle';
import { memo, useState } from 'react';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { OpenableCardIcon } from './OpenableCardIcon';
import { ShowCoverageDetailsExpandable } from './ShowCoverageDetailsExpandable';

export const CoverageCard = memo(function CoverageCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Coverage>>;
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
            <TimelineCardCategoryTitle title="Coverage" color="text-amber-600" />
            <OpenableCardIcon />
          </div>

          <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
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
      <ShowCoverageDetailsExpandable
        item={item}
        expanded={expanded}
        setExpanded={setExpanded}
      />
    </>
  );
});
