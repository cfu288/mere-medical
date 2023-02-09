import { Disclosure } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { RxDocument } from 'rxdb';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';
import { useRxDb } from '../providers/RxDbProvider';
import { useUser } from '../providers/UserProvider';
import BillboardJS, { IChart } from '@billboard.js/react';
import bb, { areaLineRange, ChartOptions } from 'billboard.js';
import 'billboard.js/dist/billboard.css';

export function ShowDiagnosticReportResultsExpandable({
  item,
  docs,
  expanded,
  setExpanded,
}: {
  item:
    | ClinicalDocument<BundleEntry<DiagnosticReport>>
    | ClinicalDocument<BundleEntry<Observation>>;
  docs: ClinicalDocument<BundleEntry<Observation>>[];
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const toggleOpen = () => setExpanded((x) => !x);

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || ''}
          setClose={toggleOpen}
        />
        <div className="max-h-full scroll-py-3 p-3">
          <div
            className={`${
              expanded ? '' : 'hidden'
            } rounded-lg border border-solid border-gray-200`}
          >
            <div className="grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-700">
              <div className="col-span-3 text-sm font-semibold">Name</div>
              <div className="col-span-2 text-sm font-semibold">Value</div>
            </div>
            {docs.map((item) => (
              <Row item={item} key={JSON.stringify(item).slice(0, 20)} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Row({ item }: { item: ClinicalDocument<BundleEntry<Observation>> }) {
  const db = useRxDb(),
    user = useUser(),
    loinc = item.metadata?.loinc_coding,
    chartComponent = useRef<IChart>(),
    [relatedLabs, setRelatedLabs] = useState<
      RxDocument<ClinicalDocument<BundleEntry<Observation>>>[]
    >([]);
  const chartMin = Math.min(
    ...(relatedLabs.map((rl) =>
      (getReferenceRangeLow(rl)?.value || Math.max) >
      (getValueQuantity(rl) || Math.max)
        ? getValueQuantity(rl)
        : getReferenceRangeLow(rl)?.value
    ) as number[])
  );
  const displayName = `${item.metadata?.display_name}`;
  const valueUnit = `(${getValueUnit(item)})`;
  const data = useMemo(
    () => [
      [
        displayName,
        ...relatedLabs.map((rl) => {
          return {
            high: getReferenceRangeHigh(rl)?.value,
            mid: getValueQuantity(rl),
            low: getReferenceRangeLow(rl)?.value,
          } as { high: number; mid: number; low: number };
        }),
      ],
      [
        'x',
        ...relatedLabs.map((rl) =>
          format(parseISO(rl.metadata?.date || ''), 'yyyy-MM-dd')
        ),
      ],
    ],
    [displayName, relatedLabs]
  );

  const options: ChartOptions = {
    data: {
      x: 'x',
      columns: data,
      types: { [displayName]: areaLineRange() },
      colors: {
        [displayName]: '#00A2D5',
      },
    },
    axis: {
      y: {
        min: chartMin,
        label: {
          text: valueUnit,
          position: 'outer-middle',
        },
      },
      x: {
        padding: {
          right: 10,
          unit: 'px',
        },
        type: 'timeseries',
        tick: {
          count: 4,
          rotate: 90,
          centered: true,
          fit: true,
          format: '%Y-%m',
        },
      },
    },
    tooltip: {
      format: {
        title: (x) => {
          return format(x, 'MMM Mo, yyyy');
        },
      },
    },
    legend: { hide: true },
  };

  useEffect(() => {
    chartComponent.current?.instance.resize();
  }, [data]);

  useEffect(() => {
    if (loinc && loinc?.length > 0) {
      db.clinical_documents
        .find({
          selector: {
            user_id: user.id,
            'metadata.loinc_coding': { $in: loinc },
          },
        })
        .exec()
        .then((res) => {
          const sorted = res.sort((a, b) =>
            new Date(a.get('metadata.date') || '') <
            new Date(b.get('metadata.date') || '')
              ? 1
              : -1
          ) as unknown as RxDocument<
            ClinicalDocument<BundleEntry<Observation>>
          >[];
          // console.log(sorted.map((i) => i.toJSON().metadata?.date));
          setRelatedLabs(sorted);
        });
    }
  }, [db.clinical_documents, loinc, user.id]);

  return (
    <Fragment
      key={`${
        (item.data_record.raw?.resource as Observation)?.id || item.metadata?.id
      }`}
    >
      {!(item.data_record.raw?.resource as Observation)?.dataAbsentReason ? (
        <Disclosure>
          {({ open }) => (
            <>
              <div className="mx-4 grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-100 py-2">
                <div className="col-span-3 self-center text-xs font-semibold text-gray-600">
                  <p>{item.metadata?.display_name}</p>
                  <p className="font-light">
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
                <div className="col-span-1 flex flex-col items-center justify-center">
                  <Disclosure.Button>
                    {open ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="h-6 w-6"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="h-6 w-6"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                        />
                      </svg>
                    )}
                  </Disclosure.Button>
                </div>
              </div>
              <Disclosure.Panel className="mx-4 grid grid-cols-6 gap-2 gap-y-2  py-2">
                {relatedLabs.map((rl) => (
                  <Fragment key={`rl-${rl.id}`}>
                    <div className="col-span-3 self-center pl-4 text-xs font-bold text-gray-600">
                      <p className="">
                        {format(
                          parseISO(rl.metadata?.date || ''),
                          'MM/dd/yyyy'
                        )}
                      </p>
                      <p className="text-xs font-light text-gray-600">
                        {getReferenceRangeString(rl)
                          ? `Range: ${getReferenceRangeString(rl)}`
                          : ''}
                      </p>
                    </div>
                    <div
                      className={`col-span-2 flex flex-col self-center text-sm ${
                        isOutOfRangeResult(rl) && 'text-red-700'
                      }`}
                    >
                      <p>
                        {getValueQuantity(rl) !== undefined
                          ? `  ${getValueQuantity(rl)}`
                          : ''}
                        {getValueUnit(rl)}{' '}
                        {getInterpretationText(rl) || getValueString(rl)}
                      </p>
                    </div>
                  </Fragment>
                ))}
              </Disclosure.Panel>
              <Disclosure.Panel className="max-w-80 mx-4 w-80 border-b-2 border-solid border-gray-100 pr-2 sm:w-full sm:max-w-max">
                <BillboardJS bb={bb} options={options} ref={chartComponent} />
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>
      ) : null}
    </Fragment>
  );
}

function getReferenceRangeString(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return item.data_record.raw.resource?.referenceRange?.[0]?.text;
}

function getReferenceRangeLow(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return item.data_record.raw.resource?.referenceRange?.[0]?.low;
}

function getReferenceRangeHigh(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return item.data_record.raw.resource?.referenceRange?.[0]?.high;
}

function getValueUnit(item: ClinicalDocument<BundleEntry<Observation>>) {
  return item.data_record.raw.resource?.valueQuantity?.unit;
}

function getValueQuantity(item: ClinicalDocument<BundleEntry<Observation>>) {
  return item.data_record.raw.resource?.valueQuantity?.value;
}

function getValueString(item: ClinicalDocument<BundleEntry<Observation>>) {
  return item.data_record.raw.resource?.valueString;
}

function getInterpretationText(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return item.data_record.raw.resource?.interpretation?.text;
}

/**
 * Takes a RxDocument of type ClinicalDocument<Observation> and returns true if the value is out of reference range
 * @param item
 */
export function isOutOfRangeResult(
  item: ClinicalDocument<BundleEntry<Observation>>
): boolean {
  const low = item.data_record.raw.resource?.referenceRange?.[0]?.low?.value;
  const high = item.data_record.raw.resource?.referenceRange?.[0]?.high?.value;
  const value = item.data_record.raw.resource?.valueQuantity?.value;

  if (low && high && value && !isNaN(low) && !isNaN(high) && !isNaN(value)) {
    return value < low || value > high;
  }
  return false;
}
