import { format, parseISO } from 'date-fns';
import { BundleEntry, Observation } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { ShowObservationResultsExpandable } from './ShowObservationResultsExpandable';
import { TimelineCardTitle } from './TimelineCardTitle';
import { memo } from 'react';
export const ObservationCard = memo(function ObservationCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Observation>>;
}) {
  return (
    <div className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm ">
      <div className="min-w-0 flex-1">
        <div className=" pb-2 text-sm font-bold text-blue-400 md:text-base">
          Observation
        </div>
        <span className="absolute inset-0" aria-hidden="true" />
        <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
        <p className="truncate text-xs font-medium text-gray-500 md:text-sm">
          {item.metadata?.date ? format(parseISO(item.metadata.date), 'p') : ''}
        </p>
        <ShowObservationResultsExpandable item={item} />
      </div>
    </div>
  );
});
