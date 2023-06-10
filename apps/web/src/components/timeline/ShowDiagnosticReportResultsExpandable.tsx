import { Disclosure } from '@headlessui/react';
import { format, parseISO, set } from 'date-fns';
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
import { TableCellsIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import * as fhirpath from 'fhirpath';
import {
  useAllConnectionDocs,
  useConnectionDoc,
} from '../hooks/useConnectionDoc';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';

export interface Card {
  summary: string;
  detail: string;
  indicator: string;
  source: Source;
  links: Link[];
}

export interface Source {
  label: string;
  url: string;
  icon: string;
}

export interface Link {
  label: string;
  url: string;
  type: string;
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
  const [cards, setCards] = useState<Card[]>([]);
  const [loadingCards, setLoadingCards] = useState<boolean>(false);
  const connectionDocs = useAllConnectionDocs();
  const mapConnectionsToFhirServices = useMemo(() => {
    return connectionDocs?.map((conn1: RxDocument<ConnectionDocument>) => {
      const conn = conn1.toJSON();
      return {
        fhirServer: conn.location,
        fhirAuthorization: {
          accessToken: conn.access_token,
          tokenType: 'bearer',
          expiresIn: conn.expires_in,
          scope: conn.scope,
          subject: (conn as any)?.client_id || 'No Subject Availible',
        },
      };
    });
  }, [connectionDocs]);

  useEffect(() => {
    console.log(mapConnectionsToFhirServices);
  }, [mapConnectionsToFhirServices]);

  useEffect(() => {
    if (expanded) {
      setLoadingCards(true);
      fetch(
        'http://127.0.0.1:8000/cds-services/sanctuary-health-diabetes-education',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            hookInstance: '12312313',
            hook: 'diagnostic-report-open',
            fhirServices: [
              {
                fhirServer: 'https://example.com/fhir',
                fhirAuthorization: {
                  accessToken: 'at12312',
                  tokenType: 'bearer',
                  expiresIn: 3600,
                  scope: 'scope/123 scope2/123',
                  subject: '12234-1234',
                },
              },
            ],
            contexts: {
              'https://example.com/fhir': {
                patientId: 'pid123',
                diagnosticReportId: 'did234',
              },
            },
          }),
        }
      )
        .then((res) => res.json())
        .then((res: Card[]) => {
          setLoadingCards(false);
          setCards(res);
        })
        .catch((e) => {
          setLoadingCards(false);
        });
    }
  }, [expanded]);

  useEffect(() => {
    if (expanded) {
      console.log(item);
    }
  }, [expanded, item]);

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
        <div className="max-h-full scroll-py-3 p-3">
          <div
            className={`border-primary-700 mb-4 rounded-lg border-4 border-dotted`}
          >
            <div className="bg-primary-700 rounded-tr-lg rounded-tl-lg px-2 py-1 font-medium text-white">
              XPC Hackathon Demo
            </div>

            <div className="p-2 px-4 text-gray-700">
              <h1 className="pb-2 font-semibold underline">
                Available Extensions
              </h1>
              {loadingCards ? (
                <div className="flex flex-row">
                  <div className="rounded-lg border border-solid border-gray-200 p-2 px-4 text-gray-700">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-xs">Loading</div>
                    </div>
                  </div>
                </div>
              ) : null}
              {cards.map((card) => (
                <div
                  className="flex flex-row rounded-lg border border-solid border-gray-200 p-2 px-4 text-gray-700"
                  key={card.summary}
                >
                  {/* image rounded icon and source */}
                  <div className="flex flex-col items-center justify-center align-middle">
                    <img
                      src={card.source.icon}
                      alt={card.source.label}
                      className="h-8 w-8"
                    />
                    <div className="w-full text-center text-xs">
                      {card.source.label}
                    </div>
                  </div>
                  <div className="flex flex-col p-2 px-4">
                    <div className="flex flex-col text-gray-700">
                      <div className="col-span-3 font-semibold">
                        {card.summary}
                      </div>
                      <div className="font-italic col-span-3 text-sm">
                        {card.detail}
                      </div>
                    </div>
                    <div className="flex flex-row pt-2">
                      {card.links.map((link) => (
                        <a
                          href={link.url}
                          className=" bg-primary hover:bg-primary-600 active:bg-primary-700 rounded-lg p-4 py-2 text-center text-white duration-75 active:scale-[98%]"
                          key={link.label}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            className={`${
              expanded ? '' : 'hidden'
            } rounded-lg border border-solid border-gray-200`}
          >
            <div className="grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-700">
              <div className="col-span-3 text-sm font-semibold">Name</div>
              <div className="col-span-2 text-sm font-semibold">Value</div>
            </div>
            {loading ? (
              <div className="mx-4 grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-100 py-2">
                <div className="col-span-3 self-center text-xs font-semibold text-gray-600">
                  Loading data
                </div>
                <div className="col-span-3 self-center text-xs font-semibold text-gray-600">
                  <ButtonLoadingSpinner height="h-3" width="w-3" />
                </div>
              </div>
            ) : null}
            {docs.map((item) => (
              <Row item={item} key={JSON.stringify(item)} />
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
  const [view, setView] = useState<'LIST' | 'GRAPH'>('GRAPH');

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
              ? 1
              : -1
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
                      <Disclosure.Button className="rounded p-1 duration-75 active:scale-90 active:bg-slate-50">
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
