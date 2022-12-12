import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { useEffect, useMemo, useState } from 'react';
import { RxDocument } from 'rxdb';
import {
  ClinicalDocument,
  MergeClinicalDocument,
} from '../models/ClinicalDocument';
import { useRxDb } from './RxDbProvider';

export function ShowDiagnosticReportResultsExpandable({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
}) {
  const [expanded, setExpanded] = useState(false);
  const db = useRxDb();
  const [docs, setDocs] = useState<RxDocument<ClinicalDocument<Observation>>[]>(
    []
  );

  const listToQuery = item.data_record.raw.resource?.result?.map(
    (item) => item.reference
  ) as string[];

  useEffect(() => {
    db.clinical_documents
      .find({
        selector: {
          'metadata.id': { $in: listToQuery },
        },
      })
      .exec()
      .then((res) => {
        setDocs(res as unknown as RxDocument<ClinicalDocument<Observation>>[]);
        console.log(res.map((x) => x.toJSON()));
      });
  }, []);

  return (
    <div key={item._id}>
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center">
          <button
            type="button"
            className="focus:ring-primary-500 inline-flex items-center rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium leading-5 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
            onClick={() => {
              setExpanded((x) => !x);
            }}
          >
            <span>Expand Results</span>
          </button>
        </div>
      </div>
      <div className={`${expanded ? '' : 'hidden'}`}>
        {docs.map((item) => (
          // eslint-disable-next-line react/jsx-no-useless-fragment
          <>
            {!(item.get('raw')?.resource as Observation)?.dataAbsentReason ? (
              <>
                <p>
                  {item.get('metadata.display_name')}
                  {'\t'}
                  {(item.get('data_record.raw').resource as Observation)
                    ?.interpretation?.text ||
                    (item.get('data_record.raw').resource as Observation)
                      ?.valueString}

                  {(item.get('data_record.raw').resource as Observation)
                    ?.valueQuantity?.value
                    ? `  ${
                        (item.get('data_record.raw').resource as Observation)
                          ?.valueQuantity?.value
                      }`
                    : ''}
                  {''}
                  {
                    (item.get('data_record.raw').resource as Observation)
                      ?.valueQuantity?.unit
                  }
                </p>
              </>
            ) : null}
          </>
        ))}
        {/* {item.data_record.raw.resource?.result?.map((item) => (
          <p key={item.id}>{item.display}</p>
        ))} */}
        {/* {list?.map((list_item) => (
          <div
            key={list_item.id || list_item.fullUrl}
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
        ))} */}
      </div>
    </div>
  );
}
