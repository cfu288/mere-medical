import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { CardBase } from '../components/connection/CardBase';
import { ResultRow } from '../components/timeline/ShowDiagnosticReportResultsExpandable';

export function PinnedListCard({
  items,
}: {
  items: ClinicalDocument<BundleEntry<DiagnosticReport | Observation>>[];
}) {
  return (
    <div className="col-span-6 sm:col-span-3 ">
      <Disclosure defaultOpen={true}>
        {({ open }) => (
          <>
            <Disclosure.Button className="w-full font-bold">
              <div className="flex w-full items-center justify-between py-6 text-xl font-extrabold">
                Bookmarked Labs
                <ChevronDownIcon
                  className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                    open ? 'rotate-180 transform ' : ''
                  }`}
                />
              </div>
            </Disclosure.Button>
            <Disclosure.Panel>
              <CardBase removePadding={true}>
                <div className="min-w-0 flex-1">
                  {items.length > 0 ? (
                    <>
                      <div className="grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-700">
                        <div className="col-span-3 text-sm font-semibold">
                          Name
                        </div>
                        <div className="col-span-2 text-sm font-semibold">
                          Value
                        </div>
                      </div>
                      {items.map((item) => (
                        <ResultRow
                          item={item as any}
                          key={JSON.stringify(item)}
                        />
                      ))}
                    </>
                  ) : (
                    <div className="mx-4 flex flex-col border-b-2 border-solid border-gray-100 py-2">
                      <div className="self-center font-semibold text-gray-600">
                        No data available for this report
                      </div>
                    </div>
                  )}
                </div>
              </CardBase>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    </div>
  );
}
