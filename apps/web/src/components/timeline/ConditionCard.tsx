import { format, parseISO } from 'date-fns';
import { BundleEntry, Condition } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { useConnectionDoc } from '../hooks/useConnectionDoc';

export function ConditionCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Condition>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);

  return (
    <div className="focus:ring-primary-700 relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm focus-within:ring-2  focus-within:ring-offset-2">
      <div className="min-w-0 flex-1">
        <div className=" pb-2 text-sm font-bold text-green-600 md:text-base">
          Condition
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
          <div className="flex h-4 animate-pulse flex-row items-center">
            <div className="mt-1 h-3 w-36 rounded-sm bg-gray-100 "></div>
          </div>
        )}
      </div>
    </div>
  );
}
