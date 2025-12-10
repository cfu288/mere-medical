/* eslint-disable react/jsx-no-useless-fragment */
import 'billboard.js/dist/billboard.css';

import bb, { areaLineRange, ChartOptions } from 'billboard.js';
import { format } from 'date-fns';
import { BundleEntry, Observation } from 'fhir/r2';
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RxDatabase, RxDocument } from 'rxdb';

import BillboardJS, { IChart } from '@billboard.js/react';
import { Disclosure } from '@headlessui/react';
import { ChartBarIcon, TableCellsIcon } from '@heroicons/react/24/outline';

import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { safeFormatDate } from '../../../shared/utils/dateFormatters';
import uuid4 from '../../../shared/utils/UUIDUtils';
import { useSummaryPagePreferences } from '../../summary/hooks/useSummaryPagePreferences';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { useUser } from '../../../app/providers/UserProvider';
import {
  getReferenceRangeLow,
  getValueQuantity,
  getValueUnit,
  getReferenceRangeHigh,
  getReferenceRangeString,
  isOutOfRangeResult,
  getInterpretationText,
  getValueString,
  getComments,
} from '../utils/fhirpathParsers';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';

function SparklineGraphSvg({
  relatedLabs,
}: {
  relatedLabs: RxDocument<ClinicalDocument<BundleEntry<Observation>>>[];
}) {
  const sparklineValues = useMemo(
    () => relatedLabs.map((rl) => (rl ? getValueQuantity(rl) : 0)) as number[],
    [relatedLabs],
  );
  const sparklineSvg = useMemo(() => {
    return relatedLabs.length > 1 ? (
      <svg viewBox="0 0 10 22" className="h-6 w-6" preserveAspectRatio="none">
        <title>Sparkline - click to open graph</title>
        <path
          d={
            NormalizePathLine(
              sparklineValues,
              getReferenceRangeLow(relatedLabs[0])?.value,
              getReferenceRangeHigh(relatedLabs[0])?.value,
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
        <title>Click to open graph</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
        />
      </svg>
    );
  }, [sparklineValues, relatedLabs]);

  return <>{sparklineSvg}</>;
}

export function ObservationResultRow({
  item,
  hideBottomDivider = false,
}: {
  item: ClinicalDocument<BundleEntry<Observation>>;
  hideBottomDivider?: boolean;
}) {
  const loinc = useMemo(
    () => item.metadata?.loinc_coding || [],
    [item.metadata?.loinc_coding],
  );

  const [isPinned, handleTogglePin] = useLabPinning(item);
  const [view, setView] = useState<'LIST' | 'GRAPH'>('GRAPH'),
    relatedLabs = useRelatedLoincLabs(loinc);

  return (
    <Fragment key={`${item.metadata?.id}`}>
      {!(item.data_record.raw?.resource as Observation)?.dataAbsentReason ? (
        <Disclosure>
          {({ open }) => (
            <>
              <div
                className={`mx-4 grid grid-cols-6 gap-2 gap-y-2 border-solid border-gray-100 py-2 ${
                  hideBottomDivider ? '' : 'border-b-2'
                }`}
              >
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
                <div className={`col-span-2 flex flex-col self-center`}>
                  <span
                    className={`text-sm ${
                      isOutOfRangeResult(item) && 'text-red-700'
                    }`}
                  >
                    {getValueQuantity(item) !== undefined
                      ? `${getValueQuantity(item)}`
                      : getInterpretationText(item) ||
                        (getValueString(item) && `${getValueString(item)}`)}
                    <span className={`pl-1 inline text-xs font-light`}>
                      {getValueUnit(item)}
                    </span>
                  </span>
                  <p
                    className={`text-xs font-light ${isOutOfRangeResult(item) ? 'text-red-700' : 'text-primary-700'}`}
                  >
                    {getValueQuantity(item) !== undefined
                      ? getInterpretationText(item) ||
                        (getValueString(item) && `${getValueString(item)}`)
                      : ''}
                  </p>
                </div>
                {/* Graphing button */}
                <div className="flex-rows col-span-1 flex items-end justify-end align-middle">
                  {relatedLabs.length > 0 &&
                    getValueQuantity(item) !== undefined && (
                      <Disclosure.Button className="text-primary-900 rounded bg-[#E2F5FA] p-1 duration-150 active:scale-90  active:bg-slate-50">
                        {open ? (
                          <>{closeXSvg}</>
                        ) : (
                          <SparklineGraphSvg relatedLabs={relatedLabs} />
                        )}
                      </Disclosure.Button>
                    )}
                  {/* Pin icon button */}
                  <button
                    className="text-primary-900 rounded  p-1 duration-150 active:scale-90 active:bg-slate-50"
                    onClick={handleTogglePin}
                  >
                    {!isPinned ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="h-6 w-6 transition-colors duration-150 active:text-slate-500"
                      >
                        <title>Pin lab</title>
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
                        className="h-6 w-6 transition-colors duration-150 active:text-slate-500"
                      >
                        <title>Unpin lab</title>
                        <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM20.25 5.507v11.561L5.853 2.671c.15-.043.306-.075.467-.094a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93zM3.75 21V6.932l14.063 14.063L12 18.088l-7.165 3.583A.75.75 0 013.75 21z" />
                      </svg>
                    )}
                  </button>
                </div>
                {/* Comment string (if exists) */}
                {getComments(item) ? (
                  <div
                    className={`col-span-2 col-start-4 flex self-center text-xs text-gray-800`}
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
                    className="text-primary-900 absolute top-0 right-0 m-2 mr-4 rounded bg-[#E2F5FA] p-1 duration-150 active:scale-90 active:bg-gray-100"
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
                              {safeFormatDate(rl.metadata?.date, 'MM/dd/yyyy')}
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
                              {getValueQuantity(item) !== undefined
                                ? `  ${getValueQuantity(item)}`
                                : ''}
                              {getValueUnit(item)}
                            </p>
                            <p
                              className={`text-xs font-light ${isOutOfRangeResult(item) ? 'text-red-700' : 'text-primary-700'}`}
                            >
                              {getInterpretationText(item) ||
                                (getValueString(item) &&
                                  `${getValueString(item)}`)}
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
                            <HistoricalRelatedLabsChart
                              relatedLabs={relatedLabs}
                              item={item}
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

function HistoricalRelatedLabsChart({
  relatedLabs,
  item,
}: {
  relatedLabs: RxDocument<ClinicalDocument<BundleEntry<Observation>>>[];
  item: ClinicalDocument<BundleEntry<Observation>>;
}) {
  const chartComponent = useRef<IChart>(),
    chartDisplayName = `${item.metadata?.display_name}`,
    chartValueUnit = `(${getValueUnit(item)})`;
  const chartData = useMemo(
    () => [
      [
        chartDisplayName,
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
          safeFormatDate(rl.metadata?.date, 'yyyy-MM-dd'),
        ),
      ],
    ],
    [chartDisplayName, relatedLabs],
  );
  const chartMin = useMemo(
    () =>
      Math.min(
        ...(relatedLabs.map((rl) =>
          (getReferenceRangeLow(rl)?.value || Number.MAX_SAFE_INTEGER) >
          (getValueQuantity(rl) || Number.MAX_SAFE_INTEGER)
            ? getValueQuantity(rl)
            : getReferenceRangeLow(rl)?.value,
        ) as number[]),
      ),
    [relatedLabs],
  );
  const chartOptions: ChartOptions = useMemo(() => {
    return {
      data: {
        x: 'x',
        columns: chartData,
        types: { [chartDisplayName]: areaLineRange() },
        colors: {
          [chartDisplayName]: '#00A2D5',
        },
      },
      axis: {
        y: {
          min: chartMin,
          label: {
            text: chartValueUnit,
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
  }, [chartMin, chartData, chartDisplayName, chartValueUnit]);

  // Chart resizing
  useEffect(() => {
    chartComponent.current?.instance.resize();
  }, [chartData]);

  return <BillboardJS bb={bb} options={chartOptions} ref={chartComponent} />;
}

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
export function NormalizePathLine(
  valueArr: number[],
  rangeMin?: number,
  rangeMax?: number,
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
            20 - ((rangeMin - min) / (max - min)) * 20,
          ),
        )
      : '',
    maxLine: rangeMax
      ? GeneratePathLine(
          Array(normalized.length).fill(
            20 - ((rangeMax - min) / (max - min)) * 20,
          ),
        )
      : '',
  };
  return res;
}

const closeXSvg = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="h-6 w-6"
  >
    <title>Close</title>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

function useLabPinning(
  item: ClinicalDocument<BundleEntry<Observation>>,
): [isPinned: boolean, handleTogglePin: () => void] {
  const user = useUser();
  const db = useRxDb();
  const summaryPagePreferencesDoc = useSummaryPagePreferences(user.id);
  const pinnedSet = useMemo(
    () => new Set(summaryPagePreferencesDoc?.pinned_labs || []),
    [summaryPagePreferencesDoc?.pinned_labs],
  );
  const [isPinned, setIsPinned] = useState<boolean>(pinnedSet.has(item.id!));
  const handleTogglePin = useCallback(() => {
    // if pinned_labs contains id, remove it, otherwise add it
    const updatedList = pinnedSet.has(item.id!)
      ? [...pinnedSet].filter((id) => id !== item.id)
      : [...pinnedSet, item.id];
    if (summaryPagePreferencesDoc) {
      summaryPagePreferencesDoc
        .update({
          $set: {
            pinned_labs: updatedList,
          },
        })
        .then(() => {
          setIsPinned(!isPinned);
        });
    } else {
      db.summary_page_preferences
        .insert({
          id: uuid4(),
          user_id: user.id,
          pinned_labs: updatedList as string[],
        })
        .then(() => {
          setIsPinned(!isPinned);
        });
    }
  }, [
    pinnedSet,
    item.id,
    summaryPagePreferencesDoc,
    isPinned,
    db.summary_page_preferences,
    user.id,
  ]);

  useEffect(() => {
    // Update pinned status in current component when preferences doc changes
    setIsPinned(pinnedSet.has(item.id!));
  }, [pinnedSet, item.id]);

  return [isPinned, handleTogglePin];
}

export function useRelatedLoincLabs(loinc: string[]) {
  const db = useRxDb(),
    user = useUser(),
    [relatedLabs, setRelatedLabs] = useState<
      RxDocument<ClinicalDocument<BundleEntry<Observation>>>[]
    >([]);

  useEffect(() => {
    getRelatedLoincLabs({ loinc, db, user }).then(setRelatedLabs);
  }, [db, loinc, user]);

  return relatedLabs;
}

export function getRelatedLoincLabs({
  loinc,
  db,
  user,
  limit,
}: {
  loinc: string[];
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
  limit?: number;
}): Promise<RxDocument<ClinicalDocument<BundleEntry<Observation>>>[]> {
  return new Promise((resolve, reject) => {
    if (loinc && loinc?.length > 0) {
      const q = db.clinical_documents.find({
        selector: {
          user_id: user.id,
          'metadata.loinc_coding': { $in: loinc },
        },
      });
      if (limit) {
        q.limit(limit);
      }
      q.exec()
        .then((res) => {
          const sorted = res.sort((a, b) =>
            new Date(a.get('metadata.date') || '') <
            new Date(b.get('metadata.date') || '')
              ? -1
              : 1,
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
          return resolve(unique);
        })
        .catch((err) => {
          reject(err);
        });
    } else {
      resolve([]);
    }
  });
}
