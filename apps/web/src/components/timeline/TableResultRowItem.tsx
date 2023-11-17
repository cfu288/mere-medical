import { Disclosure } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import { BundleEntry, Observation } from 'fhir/r2';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { RxDocument } from 'rxdb';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { useRxDb } from '../providers/RxDbProvider';
import { useUser } from '../providers/UserProvider';
import BillboardJS, { IChart } from '@billboard.js/react';
import bb, { areaLineRange, ChartOptions } from 'billboard.js';
import { TableCellsIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import {
  getReferenceRangeLow,
  getValueQuantity,
  getValueUnit,
  getReferenceRangeHigh,
  getReferenceRangeString,
  isOutOfRangeResult,
  getInterpretationText,
  getValueString,
  NormalizePathLine,
  getComments,
} from './ShowDiagnosticReportResultsExpandable';

export function TableResultRowItem({
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
                      <Disclosure.Button className="text-primary-900 rounded bg-[#E2F5FA] p-1 duration-75 active:scale-90 active:bg-slate-50">
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
