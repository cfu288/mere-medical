import { format, parseISO } from 'date-fns';
import { BundleEntry, DiagnosticReport } from 'fhir/r2';
import { ClinicalDocument } from '../../models/ClinicalDocument';
import { ShowDiagnosticReportResultsExpandable } from '../ShowDiagnosticReportResultsExpandable';
import { ShowObservationResultsExpandable } from '../ShowObservationResultsExpandable';

export function DiagnosticReportCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
}) {
  return (
    <div className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400">
      <div className="min-w-0 flex-1">
        <div className=" pb-2 font-bold text-blue-600">Labs</div>
        <span className="absolute inset-0" aria-hidden="true" />
        <p className="text-md font-bold text-gray-900">
          {item.metadata?.display_name}
        </p>
        <p className="truncate text-sm font-medium text-gray-500">
          {item.metadata?.date ? format(parseISO(item.metadata.date), 'p') : ''}
        </p>

        <ShowDiagnosticReportResultsExpandable item={item} />
      </div>
    </div>
  );
}
