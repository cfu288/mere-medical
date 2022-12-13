import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { Fragment, useEffect, useMemo, useState } from 'react';
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
    (item) => `${item.reference}`
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
        setDocs(
          (res as unknown) as RxDocument<ClinicalDocument<Observation>>[]
        );
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
      <div
        className={`${
          expanded ? '' : 'hidden'
        } rounded-lg border border-solid border-gray-200`}
      >
        <div className="grid grid-cols-2 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-700">
          <div className="text-sm font-semibold">Name</div>
          <div className="text-sm font-semibold">Value</div>
        </div>
        {docs.map((item) => (
          // eslint-disable-next-line react/jsx-no-useless-fragment
          <Fragment key={item.metadata?.id}>
            {!(item.get('raw')?.resource as Observation)?.dataAbsentReason ? (
              <div className="mx-4 grid grid-cols-2 gap-2 gap-y-2 border-b-2 border-solid border-gray-50 py-2">
                <div className="self-center text-xs font-bold text-gray-600">
                  <p>{item.get('metadata.display_name')}</p>
                  <p>{(item.get('data_record.raw').resource as Observation)?.referenceRange?.[0]?.text ? `Range: ${(item.get('data_record.raw').resource as Observation)?.referenceRange?.[0]?.text}` : ''}</p>
                </div>
                <div className="flex self-center text-sm">
                  {(item.get('data_record.raw').resource as Observation)
                    ?.interpretation?.text ||
                    (item.get('data_record.raw').resource as Observation)
                      ?.valueString}
                  {(item.get('data_record.raw').resource as Observation)
                    ?.valueQuantity?.value !== undefined
                    ? `  ${
                        (item.get('data_record.raw').resource as Observation)
                          ?.valueQuantity?.value
                      }`
                    : ''}
                  {
                    (item.get('data_record.raw').resource as Observation)
                      ?.valueQuantity?.unit
                  }
                </div>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
