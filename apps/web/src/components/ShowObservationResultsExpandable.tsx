import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { useMemo, useState } from 'react';
import {
  ClinicalDocument,
  MergeClinicalDocument,
} from '../models/ClinicalDocument';

export function ShowObservationResultsExpandable({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DiagnosticReport | Observation>>;
}) {
  const [expanded, setExpanded] = useState(false);

  const list = useMemo(
    () =>
      (
        item as MergeClinicalDocument<
          BundleEntry<DiagnosticReport | Observation>
        >
      )?.data_items?.sort((a, b) => {
        if (!a?.fullUrl?.[0]) return 0;
        return a?.fullUrl?.[0]?.localeCompare(b?.fullUrl?.[0] || '') || 0;
      }),
    [item]
  );

  return (
    <div key={item._id}>
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center">
          <button
            type="button"
            className="inline-flex items-center shadow-sm px-4 py-1.5 border border-gray-300 text-sm leading-5 font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => {
              setExpanded((x) => !x);
            }}
          >
            <span>Expand Results</span>
          </button>
        </div>
      </div>
      <div className={`${expanded ? '' : 'hidden'}`}>
        {list?.map((list_item) => (
          <div
            key={list_item.id}
            className="flex flex-row gap-2 text-sm text-gray-600"
          >
            {!(list_item.resource as Observation)?.dataAbsentReason && (
              <>
                <div>{list_item.resource?.category?.text} result: </div>
                <div>
                  {(list_item.resource as Observation)?.interpretation?.text ||
                    (list_item.resource as Observation)?.valueString}
                </div>
                <div>
                  {(list_item.resource as Observation)?.valueQuantity?.value}
                  {(list_item.resource as Observation)?.valueQuantity?.unit}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
