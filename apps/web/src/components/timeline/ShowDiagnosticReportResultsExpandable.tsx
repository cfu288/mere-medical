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
import { ButtonLoadingSpinner } from '../connection/ButtonLoadingSpinner';
import {
  TableCellsIcon,
  ChartBarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import * as fhirpath from 'fhirpath';
import { AnimatePresence, motion } from 'framer-motion';

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
  id,
}: {
  item:
    | ClinicalDocument<BundleEntry<DiagnosticReport>>
    | ClinicalDocument<BundleEntry<Observation>>;
  docs: ClinicalDocument<BundleEntry<Observation>>[];
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  loading?: boolean;
  id?: string;
}) {
  const toggleOpen = () => setExpanded((x) => !x);

  useEffect(() => {
    if (expanded) {
      console.log(item);
    }
  }, [expanded, item]);

  return (
    <AnimatePresence initial={false}>
      {expanded ? (
        <motion.div className="relative z-30">
          {/* Background opacity */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-500 bg-opacity-50 transition-opacity"
          />
          {/* Modal */}
          <motion.div className="fixed inset-0 z-10 flex flex-col overflow-y-auto pt-12 sm:p-12">
            <motion.div
              layoutId={`card-base-${id}`}
              className="mx-auto w-screen rounded-xl border border-gray-100 bg-white shadow-2xl sm:w-auto sm:min-w-[50%] sm:max-w-3xl"
            >
              <motion.div className="flex flex-col">
                <motion.div className="flex w-full flex-col p-4 pb-2">
                  <motion.div
                    layoutId={`card-category-title-${id}`}
                    className="flex w-12 scale-y-0 transform flex-row items-center pb-1 align-middle text-sm font-bold opacity-0 sm:pb-2 md:text-base"
                  >
                    <p className="mr-1 w-12"></p>
                  </motion.div>
                  <motion.div className="flex justify-between">
                    <motion.p
                      layoutId={`card-title-${id}`}
                      className="w-full text-xl font-bold"
                    >
                      {item.metadata?.display_name
                        ?.replace(/- final result/gi, '')
                        .replace(/- final/gi, '')}
                    </motion.p>
                    <motion.button
                      type="button"
                      layoutId={`card-close-${id}`}
                      className="ml-4 rounded bg-white text-gray-500 duration-75 hover:text-gray-700 focus:text-gray-700 focus:outline-none focus:ring-0 active:scale-90 active:bg-slate-50"
                      onClick={() => setExpanded(false)}
                    >
                      <motion.span className="sr-only">Close</motion.span>
                      <XMarkIcon className="h-8 w-8" aria-hidden="true" />
                    </motion.button>
                  </motion.div>
                  <div className="flex flex-col">
                    <motion.div
                      layoutId={`card-subtitle-${id}`}
                      className="text-sm font-light"
                    >
                      {format(
                        parseISO(item.metadata?.date || ''),
                        'LLLL do yyyy'
                      )}
                      <p className="text-sm font-light">
                        {Array.isArray(item.data_record.raw.resource?.performer)
                          ? item.data_record.raw.resource?.performer?.[0]
                              .display
                          : item.data_record.raw.resource?.performer?.display}
                      </p>
                    </motion.div>
                  </div>
                </motion.div>
                <motion.div layoutId={`card-content-${id}`}>
                  {loading ? (
                    <div className="max-h-full scroll-py-3 p-3">
                      <div
                        className={`${
                          expanded ? '' : 'hidden'
                        } rounded-lg border border-solid border-gray-200`}
                      >
                        <div className="grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-700">
                          <div className="col-span-3 text-sm font-semibold">
                            Name
                          </div>
                          <div className="col-span-2 text-sm font-semibold">
                            Value
                          </div>
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
                              <div className="col-span-3 text-sm font-semibold">
                                Name
                              </div>
                              <div className="col-span-2 text-sm font-semibold">
                                Value
                              </div>
                            </div>
                            {docs.map((item) => (
                              <Row item={item} key={JSON.stringify(item)} />
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
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
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
          setRelatedLabs(sorted);
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
                <div className="col-span-1 flex flex-col items-end justify-end align-middle">
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
