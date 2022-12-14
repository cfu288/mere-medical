import { format, parseISO } from 'date-fns';
import { BundleEntry, DiagnosticReport, FhirResource } from 'fhir/r2';
import { RxDatabase, RxDocument } from 'rxdb';
import { ClinicalDocument } from '../../models/ClinicalDocument';
import { ConnectionDocument } from '../../models/ConnectionDocument';
import { DatabaseCollections } from '../RxDbProvider';
import { ShowDiagnosticReportResultsExpandable } from '../ShowDiagnosticReportResultsExpandable';
import { useConnectionDoc } from './useConnectionDoc';

export function DiagnosticReportCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
}) {
  const conn = useConnectionDoc(item.source_record);

  return (
    <div className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400">
      <div className="min-w-0 flex-1">
        <div className=" pb-2 font-bold text-blue-600">Labs</div>
        <span className="absolute inset-0" aria-hidden="true" />
        <p className="text-md pb-2 font-bold text-gray-900">
          {item.metadata?.display_name}
        </p>
        <p className="truncate text-sm font-medium text-gray-500">
          {item.metadata?.date ? format(parseISO(item.metadata.date), 'p') : ''}
        </p>
        <p className="truncate text-sm font-medium text-gray-400">
          {conn?.get('name')}
        </p>
      </div>
      <ShowDiagnosticReportResultsExpandable item={item} />
    </div>
  );
}
