import { Disclosure } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RxDocument } from 'rxdb';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';
import { useRxDb } from '../providers/RxDbProvider';
import { useUser } from '../providers/UserProvider';
import BillboardJS, { IChart } from '@billboard.js/react';
import bb, { areaLineRange, ChartOptions } from 'billboard.js';
import 'billboard.js/dist/billboard.css';
import { ButtonLoadingSpinner } from '../connection/ButtonLoadingSpinner';
import { TableCellsIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import * as fhirpath from 'fhirpath';
import { useClinicalDoc } from '../hooks/useClinicalDoc';

/**
 * Generate line for sparkline path
 */
function GeneratePathLine(valueArr: number[]) {
  // graph is 10 units long
  // valueArr is 5 up to units long, can be less
  // calculate unit spacing between points, rounded down
  const unit = 12 / valueArr.length;
  let path = '';
  valueArr.forEach((v, i) => {
    if (i === 0) {
      path += `M ${i} ${v + 1}`;
      return;
    }
    path += ` L ${i * unit} ${v + 1}`;
  });
  return path;
}

/** Takes an array of 5 values and returns a normalized path string for sparkline
 * Takes an optional rangeMin and rangeMax to normalize to, otherwise uses min and max of valueArr
 * */
function NormalizePathLine(
  valueArr: number[],
  rangeMin?: number,
  rangeMax?: number
) {
  let min = Math.min(...valueArr);
  let max = Math.max(...valueArr);

  if (rangeMin !== undefined) {
    if (rangeMin < min) {
      min = rangeMin;
    }
  }
  if (rangeMax !== undefined) {
    if (rangeMax > max) {
      max = rangeMax;
    }
  }

  const normalized = valueArr.map((v) => {
    return 20 - ((v - min) / (max - min)) * 20;
  });

  const res = {
    line: GeneratePathLine(normalized),
    minLine: rangeMin
      ? GeneratePathLine(
          Array(normalized.length).fill(
            20 - ((rangeMin - min) / (max - min)) * 20
          )
        )
      : '',
    maxLine: rangeMax
      ? GeneratePathLine(
          Array(normalized.length).fill(
            20 - ((rangeMax - min) / (max - min)) * 20
          )
        )
      : '',
  };
  return res;
}

export function ShowDiagnosticReportResultsExpandable({
  item,
  docs,
  expanded,
  setExpanded,
  loading,
}: {
  item:
    | ClinicalDocument<BundleEntry<DiagnosticReport>>
    | ClinicalDocument<BundleEntry<Observation>>;
  docs: ClinicalDocument<BundleEntry<Observation>>[];
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  loading?: boolean;
}) {
  const toggleOpen = () => setExpanded((x) => !x);

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || ''}
          subtitle={
            <div className="flex flex-col">
              <div className="text-sm font-light">
                {format(parseISO(item.metadata?.date || ''), 'LLLL do yyyy')}
              </div>
              <div className="text-sm font-light">
                {Array.isArray(item.data_record.raw.resource?.performer)
                  ? item.data_record.raw.resource?.performer?.[0].display
                  : item.data_record.raw.resource?.performer?.display}
              </div>
            </div>
          }
          setClose={toggleOpen}
        />
        {loading ? (
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
              <div className="mx-4 grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-100 py-2">
                <div className="col-span-3 self-center text-xs font-semibold text-gray-600">
                  Loading data
                </div>
                <div className="col-span-3 self-center text-xs font-semibold text-gray-600">
                  <ButtonLoadingSpinner height="h-3" width="w-3" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {docs.length > 0 ? (
              <div className="max-h-full scroll-py-3 p-3">
                <div
                  className={`${
                    expanded ? '' : 'hidden'
                  } rounded-lg border border-solid border-gray-200`}
                >
                  <div className="grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-700">
                    <div className="col-span-3 text-sm font-semibold">Name</div>
                    <div className="col-span-2 text-sm font-semibold">
                      Value
                    </div>
                  </div>
                  {docs.map((item) => (
                    <ResultRow item={item} key={JSON.stringify(item)} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-4 flex flex-col border-b-2 border-solid border-gray-100 py-2">
                <div className="self-center font-semibold text-gray-600">
                  No data available for this report
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export function ResultRow({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Observation>>;
}) {
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
  const [view, setView] = useState<'LIST' | 'GRAPH'>('GRAPH');
  const sparklineLabs = relatedLabs;
  const sparklineValues = sparklineLabs.map((rl) =>
    rl ? getValueQuantity(rl) : 0
  ) as number[];

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
          rotate: 125,
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

  const doc = useClinicalDoc(item?.metadata?.id) as RxDocument<
    ClinicalDocument<Observation | DiagnosticReport>
  >;

  const [isPinned, setIsPinned] = useState<boolean>(
    item.metadata?.is_pinned || false
  );

  const handleTogglePin = useCallback(() => {
    const is_pinned = doc?.metadata?.is_pinned;
    if (doc) {
      doc
        .update({
          $set: {
            'metadata.is_pinned': !is_pinned,
          },
        })
        .then(() => {
          setIsPinned(!is_pinned);
        });
    }
  }, [doc]);

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
              ? -1
              : 1
          ) as unknown as RxDocument<
            ClinicalDocument<BundleEntry<Observation>>
          >[];
          // sorted list may have duplicate dates, remove them so only latest of each date is shown
          const seen = new Set();
          const unique = sorted.filter((item) => {
            const date = item.get('metadata.date');
            if (!seen.has(date)) {
              seen.add(date);
              return true;
            }
            return false;
          });
          setRelatedLabs(unique);
        });
    }
  }, [db.clinical_documents, loinc, user.id]);

  return (
    <Fragment key={`${item.metadata?.id}`}>
      {!(item.data_record.raw?.resource as Observation)?.dataAbsentReason ? (
        <Disclosure>
          {({ open }) => (
            <>
              <div className="mx-4 grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-100 py-2">
                {/* Lab Row Name */}
                <div className="col-span-3 self-center text-xs font-semibold text-gray-600">
                  <p>{item.metadata?.display_name}</p>
                  <p className="font-light">
                    {getReferenceRangeString(item)
                      ? `Range: ${getReferenceRangeString(item)}`
                      : ''}
                  </p>
                </div>
                {/* Value string */}
                <div
                  className={`col-span-2 flex self-center text-sm ${
                    isOutOfRangeResult(item) && 'text-red-700'
                  }`}
                >
                  {getValueQuantity(item) !== undefined
                    ? `  ${getValueQuantity(item)}`
                    : ''}
                  {getValueUnit(item)}
                  {getInterpretationText(item) ||
                    (getValueString(item) && `${getValueString(item)}`)}
                </div>
                {/* Graphing button */}
                <div className="flex-rows col-span-1 flex items-end justify-end align-middle">
                  {relatedLabs.length > 0 &&
                    getValueQuantity(item) !== undefined && (
                      <Disclosure.Button className="text-primary-900 rounded bg-[#E2F5FA] p-1 duration-75 active:scale-90  active:bg-slate-50">
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
                          <>
                            {relatedLabs.length > 1 ? (
                              <svg
                                viewBox="0 0 10 22"
                                className="h-6 w-6"
                                preserveAspectRatio="none"
                              >
                                <path
                                  d={
                                    NormalizePathLine(
                                      sparklineValues,
                                      getReferenceRangeLow(sparklineLabs[0])
                                        ?.value,
                                      getReferenceRangeHigh(sparklineLabs[0])
                                        ?.value
                                    ).line
                                  }
                                  strokeWidth="1.5"
                                  stroke="black"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="transparent"
                                  vectorEffect="non-scaling-stroke"
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
                          </>
                        )}
                      </Disclosure.Button>
                    )}
                  {/* Pin icon button */}

                  <button
                    className="text-primary-900 rounded  p-1 duration-75 active:scale-90 active:bg-slate-50"
                    onClick={handleTogglePin}
                  >
                    {!isPinned ? (
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
                          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-6 w-6"
                      >
                        <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM20.25 5.507v11.561L5.853 2.671c.15-.043.306-.075.467-.094a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93zM3.75 21V6.932l14.063 14.063L12 18.088l-7.165 3.583A.75.75 0 013.75 21z" />
                      </svg>
                    )}
                  </button>
                </div>
                {/* Comment string (if exists) */}
                {getComments(item) ? (
                  <div
                    className={`col-span-2 col-start-4 flex self-center text-xs text-gray-700`}
                  >
                    {getComments(item)}
                  </div>
                ) : null}
              </div>
              {/* Previous results and graph */}
              {relatedLabs.length > 0 && (
                <Disclosure.Panel className="relative border-b-4 border-solid border-gray-100">
                  {/* Toggle select between graph view and list view */}

                  <button
                    className="text-primary-900 absolute top-0 right-0 m-2 mr-4 rounded bg-[#E2F5FA] p-1 duration-75 active:scale-90 active:bg-gray-100"
                    onClick={() =>
                      setView((v) => {
                        return v === 'GRAPH' ? 'LIST' : 'GRAPH';
                      })
                    }
                  >
                    {view === 'GRAPH' ? (
                      <TableCellsIcon className="h-6 w-6" aria-hidden="true" />
                    ) : (
                      <ChartBarIcon className="h-6 w-6" aria-hidden="true" />
                    )}
                  </button>
                  {view === 'LIST' ? (
                    <div className="m-4 grid grid-cols-6 gap-2 gap-y-2 py-2">
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
                    </div>
                  ) : null}
                  {view === 'GRAPH' ? (
                    <div className="mx-4 mt-4">
                      {getValueQuantity(item) !== undefined ? (
                        <div className="flex justify-center px-2 align-middle">
                          <div className="mr-4 w-full sm:w-5/6">
                            <BillboardJS
                              bb={bb}
                              options={options}
                              ref={chartComponent}
                            />
                          </div>
                        </div>
                      ) : (
                        <p> This data cannot be graphed</p>
                      )}
                    </div>
                  ) : null}
                </Disclosure.Panel>
              )}
            </>
          )}
        </Disclosure>
      ) : (
        <div>
          {
            <div className="mx-4 grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-100 py-2">
              <div className="col-span-3 self-center text-xs font-semibold text-gray-600">
                Data missing reason
              </div>
              <div className="col-span-2 flex self-center text-sm ">
                {
                  (item.data_record.raw?.resource as Observation)
                    ?.dataAbsentReason?.text
                }
              </div>
              <div className="col-span-1 flex flex-col items-center justify-center"></div>
            </div>
          }
        </div>
      )}
    </Fragment>
  );
}

function getReferenceRangeString(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'referenceRange.text'
  )?.[0];
}

function getReferenceRangeLow(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'referenceRange.low'
  )?.[0];
}

function getReferenceRangeHigh(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'referenceRange.high'
  )?.[0];
}

function getValueUnit(
  item: ClinicalDocument<BundleEntry<Observation>>
): string | undefined {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'valueQuantity.unit'
  )?.[0];
}

function getValueQuantity(
  item: ClinicalDocument<BundleEntry<Observation>>
): number | undefined {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'valueQuantity.value'
  )?.[0];
}

function getValueString(item: ClinicalDocument<BundleEntry<Observation>>) {
  return fhirpath.evaluate(item.data_record.raw.resource, 'valueString')?.[0];
}

function getComments(item: ClinicalDocument<BundleEntry<Observation>>) {
  return fhirpath.evaluate(item.data_record.raw.resource, 'comments')?.[0];
}

function getInterpretationText(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'interpretation.text'
  )?.[0];
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
