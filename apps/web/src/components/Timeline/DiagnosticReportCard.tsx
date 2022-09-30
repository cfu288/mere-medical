import { format, parseISO } from 'date-fns';
import { BundleEntry, DiagnosticReport } from 'fhir/r2';
import { ClinicalDocument } from '../../models/ClinicalDocument';
import { ShowObservationResultsExpandable } from '../ShowObservationResultsExpandable';

export function DiagnosticReportCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
}) {
  return (
    <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400">
      <div className="flex-1 min-w-0">
        <div className=" text-red-600 font-bold pb-2">Diagnostic</div>
        <span className="absolute inset-0" aria-hidden="true" />
        <p className="text-md font-bold text-gray-900">
          {item.metadata?.display_name}
        </p>
        <p className="text-sm font-medium text-gray-500 truncate">
          {item.metadata?.date ? format(parseISO(item.metadata.date), 'p') : ''}
        </p>
        <ShowObservationResultsExpandable item={item} />
      </div>
    </div>
  );
}
