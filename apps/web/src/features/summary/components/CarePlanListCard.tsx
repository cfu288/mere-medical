import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { BundleEntry, CarePlan } from 'fhir/r2';
import { Fragment } from 'react';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { CardBase } from '../../connections/components/CardBase';

export function CarePlanListCard({
  items,
}: {
  items: ClinicalDocument<BundleEntry<CarePlan>>[];
}) {
  if (
    items.length === 0 ||
    items.filter((i) => i.data_record.raw.resource?.goal).length === 0
  )
    return null;

  return (
    <div className="col-span-6 sm:col-span-3 ">
      <Disclosure defaultOpen={true}>
        {({ open }) => (
          <>
            <Disclosure.Button className="w-full font-bold">
              <div className="flex w-full items-center justify-between py-6 text-xl font-extrabold">
                Care Plan
                <ChevronDownIcon
                  className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                    open ? 'rotate-180 transform' : ''
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
                <CardBase>
                  <div className="min-w-0 flex-1">
                    {items.map((item) => (
                      <Fragment key={item.metadata?.id}>
                        {item.data_record.raw.resource?.goal &&
                        item.data_record.raw.resource?.goal?.length !== 0 ? (
                          <div className="py-2">
                            {item.data_record.raw.resource?.addresses?.map(
                              (item) => (
                                <p
                                  key={item.id}
                                  className="text-sm font-bold text-gray-900 md:text-base"
                                >
                                  {item.display}
                                </p>
                              ),
                            )}
                            <ul>
                              {item.data_record.raw.resource?.goal?.map(
                                (item) => (
                                  <li
                                    key={item.id}
                                    className="pl-4 text-base text-gray-600"
                                  >
                                    {' -    '}
                                    {item.display}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        ) : null}
                      </Fragment>
                    ))}
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
