import { format, parseISO } from 'date-fns';
import { BundleEntry, MedicationStatement } from 'fhir/r2';
import { ClinicalDocument } from '../../models/ClinicalDocument';
import { useConnectionDoc } from './useConnectionDoc';

export function MedicationCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<MedicationStatement>>;
}) {
  const conn = useConnectionDoc(item.source_record);

  return (
    <div className="focus-within:ring-primary-500 relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-offset-2 hover:border-gray-400">
      <div className="min-w-0 flex-1">
        <div className=" pb-2 font-bold text-fuchsia-500">Medication</div>
        <span className="absolute inset-0" aria-hidden="true" />
        <p className="text-md font-bold text-gray-900">
          {item.metadata?.display_name}
        </p>
        <p className="truncate text-sm font-medium text-gray-500">
          {item.metadata?.date ? format(parseISO(item.metadata.date), 'p') : ''}
        </p>
        <p className="truncate text-sm font-medium text-gray-400">
          {conn?.get('name')}
        </p>
      </div>
    </div>
  );
}
