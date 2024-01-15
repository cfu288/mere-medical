import { format, parseISO } from 'date-fns';
import { BundleEntry, Observation } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { TimelineCardTitle } from './TimelineCardTitle';
import { memo, useState } from 'react';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { CardBase } from '../connection/CardBase';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { ShowDiagnosticReportResultsExpandable } from './ShowDiagnosticReportResultsExpandable';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { OpenableCardIcon } from './OpenableCardIcon';

export const ObservationCard = memo(function ObservationCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Observation>>;
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
            <TimelineCardCategoryTitle
              title="Observation"
              color="text-sky-600"
            />
            <OpenableCardIcon />
          </div>
          <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
          <p className="truncate text-xs font-medium text-gray-700 md:text-sm">
            {item.metadata?.date
              ? format(parseISO(item.metadata.date), 'p')
              : ''}
          </p>
          {conn?.get('name') ? (
            <p className="truncate text-xs font-medium text-gray-400 md:text-sm">
              {conn?.get('name')}
            </p>
          ) : (
            <SkeletonLoadingText />
          )}
        </div>
      </CardBase>
      <ShowDiagnosticReportResultsExpandable
        docs={[item]}
        item={item}
        expanded={expanded}
        setExpanded={setExpanded}
      />
    </>
  );
});
