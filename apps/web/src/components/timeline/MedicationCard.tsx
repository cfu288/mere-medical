import { format, parseISO } from 'date-fns';
import { BundleEntry, MedicationStatement } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardBase } from './TimelineCardBase';

export function MedicationCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<MedicationStatement>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);

  return (
    <TimelineCardBase>
      <div className="min-w-0 flex-1">
        <div className=" pb-2 text-sm font-bold text-fuchsia-500 md:text-base">
          Medication
        </div>
        <span className="absolute inset-0" aria-hidden="true" />
        <p className="text-sm font-bold text-gray-900 md:text-base">
          {item.metadata?.display_name}
        </p>
        <p className="truncate text-xs font-medium text-gray-500 md:text-sm">
          {item.metadata?.date ? format(parseISO(item.metadata.date), 'p') : ''}
        </p>
        {conn?.get('name') ? (
          <p className="h-4 truncate text-xs font-medium text-gray-400 md:text-sm">
            {conn?.get('name')}
          </p>
        ) : (
          <SkeletonLoadingText />
        )}
      </div>
    </TimelineCardBase>
  );
}
