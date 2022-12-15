import { format, parseISO } from 'date-fns';
import { BundleEntry, DiagnosticReport } from 'fhir/r2';
import { useState } from 'react';
import { ClinicalDocument } from '../../models/ClinicalDocument';
import { ShowDiagnosticReportResultsExpandable } from '../ShowDiagnosticReportResultsExpandable';
import { useConnectionDoc } from './useConnectionDoc';

export function DiagnosticReportCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
}) {
  const conn = useConnectionDoc(item.source_record);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="focus:ring-primary-700 relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
      onClick={() => setExpanded((x) => !x)}
      tabIndex={0}
    >
      <div className="min-w-0 flex-1">
        <div className="items-top flex justify-between">
          <div className=" pb-2 font-bold text-blue-600">Labs</div>
          <ShowDiagnosticReportResultsExpandable
            item={item}
            expanded={expanded}
            setExpanded={setExpanded}
          />
        </div>
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
    </div>
  );
}
