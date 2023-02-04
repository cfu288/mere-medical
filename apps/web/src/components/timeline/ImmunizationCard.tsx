import { format, parseISO } from 'date-fns';
import { BundleEntry, Immunization } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardBase } from './TimelineCardBase';
import { TimelineCardTitle } from './TimelineCardTitle';

export function ImmunizationCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Immunization>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);

  return (
    <TimelineCardBase>
      <div className="min-w-0 flex-1">
        <div className="pb-2 text-sm font-bold text-purple-600 md:text-base">
          Immunization
        </div>
        <span className="absolute inset-0" aria-hidden="true" />
        <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>

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
}
