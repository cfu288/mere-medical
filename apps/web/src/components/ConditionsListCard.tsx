import { format, parseISO } from 'date-fns';
import { BundleEntry, Condition, MedicationStatement } from 'fhir/r2';
import { ClinicalDocument } from '../models/ClinicalDocument';

export function ConditionsListCard({
  items,
}: {
  items: ClinicalDocument<BundleEntry<Condition>>[];
}) {
  return (
    <>
      <div className="font-extrabold text-xl py-6">Conditions</div>
      <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 ">
        <div className="flex-1 min-w-0">
          <span className="absolute inset-0" aria-hidden="true" />
          {items.map((item) => (
            <div className="py-2">
              <p className="text-md font-bold text-gray-900">
                {item.metadata?.display_name}
              </p>
              <p className="text-sm font-medium text-gray-500 truncate">
                {item.metadata?.date
                  ? format(parseISO(item.metadata.date), 'p')
                  : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}