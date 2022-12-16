import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { RxDocument } from 'rxdb';
import { ClinicalDocument } from '../models/ClinicalDocument';
import { Modal } from './Modal';
import { ModalHeader } from './ModalHeader';
import { useRxDb } from './RxDbProvider';

export function ShowDiagnosticReportResultsExpandable({
  item,
  expanded,
  setExpanded,
}: {
  item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const db = useRxDb(),
    [docs, setDocs] = useState<RxDocument<ClinicalDocument<Observation>>[]>([]),
    listToQuery = useMemo(() => {
      return [
        ...new Set(
          item.data_record.raw.resource?.result?.map(
            (item) => `${item.reference}`
          )
        ),
      ] as string[];
    }, [item.data_record.raw.resource?.result]),
    toggleOpen = () => setExpanded((x) => !x);

  useEffect(() => {
    if (expanded && docs.length === 0) {
      db.clinical_documents
        .find({
          selector: {
            'metadata.id': { $in: listToQuery },
          },
        })
        .exec()
        .then((res) => {
          setDocs(
            res as unknown as RxDocument<ClinicalDocument<Observation>>[]
          );
        });
    }
  }, [db.clinical_documents, docs.length, expanded, listToQuery]);

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || ''}
          setClose={toggleOpen}
        />
        <div className="max-h-full  scroll-py-3 p-3">
          <div
            className={`${
              expanded ? '' : 'hidden'
            } rounded-lg border border-solid border-gray-200`}
          >
            <div className="grid grid-cols-5 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-700">
              <div className="col-span-3 text-sm font-semibold">Name</div>
              <div className="col-span-2 text-sm font-semibold">Value</div>
            </div>
            {docs.map((item) => (
              // eslint-disable-next-line react/jsx-no-useless-fragment
              <Fragment
                key={`${
                  (item.get('data_record.raw')?.resource as Observation)?.id ||
                  item.metadata?.id
                }`}
              >
                {!(item.get('data_record.raw')?.resource as Observation)
                  ?.dataAbsentReason ? (
                  <div className="mx-4 grid grid-cols-5 gap-2 gap-y-2 border-b-2 border-solid border-gray-50 py-2">
                    <div className="col-span-3 self-center text-xs font-bold text-gray-600">
                      <p>{item.get('metadata.display_name')}</p>
                      <p>
                        {getReferenceRangeString(item)
                          ? `Range: ${getReferenceRangeString(item)}`
                          : ''}
                      </p>
                    </div>
                    <div
                      className={`col-span-2 flex self-center text-sm ${
                        isOutOfRangeResult(item) && 'text-red-700'
                      }`}
                    >
                      {getValueQuantity(item) !== undefined
                        ? `  ${getValueQuantity(item)}`
                        : ''}
                      {getValueUnit(item)}{' '}
                      {getInterpretationText(item) || getValueString(item)}
                      {/* {getCommentString(item)} */}
                    </div>
                    <div className="col-span-1"></div>
                  </div>
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function getCommentString(item: RxDocument<ClinicalDocument<Observation>>) {
  return (item.get('data_record.raw').resource as Observation)?.comments;
}

function getReferenceRangeString(
  item: RxDocument<ClinicalDocument<Observation>>
) {
  return item.get('data_record.raw').resource?.referenceRange?.[0]?.text;
}

function getValueUnit(item: RxDocument<ClinicalDocument<Observation>>) {
  return item.get('data_record.raw').resource?.valueQuantity?.unit;
}

function getValueQuantity(item: RxDocument<ClinicalDocument<Observation>>) {
  return item.get('data_record.raw').resource?.valueQuantity?.value;
}

function getValueString(item: RxDocument<ClinicalDocument<Observation>>) {
  return item.get('data_record.raw').resource?.valueString;
}

function getInterpretationText(
  item: RxDocument<ClinicalDocument<Observation>>
) {
  return item.get('data_record.raw').resource?.interpretation?.text;
}

/**
 * Takes a RxDocument of type ClinicalDocument<Observation> and returns true if the value is out of reference range
 * @param item
 */
function isOutOfRangeResult(
  item: RxDocument<ClinicalDocument<Observation>>
): boolean {
  const low =
    item.get('data_record.raw').resource?.referenceRange?.[0]?.low?.value;
  const high =
    item.get('data_record.raw').resource?.referenceRange?.[0]?.high?.value;
  const value = item.get('data_record.raw').resource?.valueQuantity?.value;

  if (!isNaN(low) && !isNaN(high) && !isNaN(value)) {
    return value < low || value > high;
  }
  return false;
}
