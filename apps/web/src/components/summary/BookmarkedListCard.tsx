import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { CardBase } from '../connection/CardBase';
import { ObservationResultRow } from '../timeline/ObservationResultRow';
import { BookmarkIcon } from '@heroicons/react/24/outline';

export function BookmarkedListCard({
  items,
}: {
  items: ClinicalDocument<BundleEntry<DiagnosticReport | Observation>>[];
}) {
  return (
    <div className="col-span-6 lg:col-span-3">
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
            <Transition
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-out"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <Disclosure.Panel>
                <CardBase removePadding={true}>
                  <div className="min-w-0 flex-1">
                    {items.length > 0 ? (
                      <>
                        <div className="grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-800">
                          <div className="col-span-3 text-sm font-semibold">
                            Name
                          </div>
                          <div className="col-span-2 text-sm font-semibold">
                            Value
                          </div>
                        </div>
                        {items.map((item, i, arr) => (
                          <ObservationResultRow
                            item={item as any}
                            key={JSON.stringify(item)}
                            hideBottomDivider={i === arr.length - 1}
                          />
                        ))}
                      </>
                    ) : (
                      <div className="mx-4 flex flex-col py-6">
                        <div className="self-center font-semibold text-gray-700">
                          Bookmark some labs to see them here
                        </div>
                        <p className="self-center text-gray-600">
                          Bookmarking labs will allow you to quickly access them
                          here. You can bookmark labs from the timeline by
                          selecting the{' '}
                          <BookmarkIcon className="h-4 w-4 inline" /> icon.
                        </p>
                      </div>
                    )}
                  </div>
                </CardBase>
              </Disclosure.Panel>
            </Transition>
          </>
        )}
      </Disclosure>
    </div>
  );
}
