import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { format, parseISO } from 'date-fns';
import { AllergyIntolerance, BundleEntry } from 'fhir/r2';
import { Fragment } from 'react';
import { ClinicalDocument } from '../../models/ClinicalDocument';

export function AllerrgyIntoleranceListCard({
  items,
}: {
  items: ClinicalDocument<BundleEntry<AllergyIntolerance>>[];
}) {
  if (items.length === 0) return null;
  return (
    <Disclosure defaultOpen={true}>
      {({ open }) => (
        <>
          <Disclosure.Button className="w-full font-bold">
            <div className="flex w-full items-center justify-between py-6 text-xl font-extrabold">
              Allergies
              <ChevronDownIcon
                className={` h-8 w-8 ${open ? 'rotate-180 transform' : ''}`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel>
            <div className="focus-within:ring-primary-500 focus:ring-primary-700 relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm focus-within:ring-2  focus-within:ring-offset-2">
              <div className="min-w-0 flex-1">
                <span className="absolute inset-0" aria-hidden="true" />
                {items.map((item) => (
                  <div className="py-2" key={item._id}>
                    <p className="font-bold text-gray-800">
                      {item.data_record.raw.resource?.substance.text}{' '}
                      {item.data_record.raw.resource?.reaction &&
                        item.data_record.raw.resource?.reaction?.length &&
                        ' - '}
                      {item.data_record.raw.resource?.reaction?.map((rxn) => (
                        <Fragment>
                          {rxn.manifestation.map(
                            (man, i) =>
                              `${man.text}${
                                i < (rxn.manifestation?.length - 1 || 0)
                                  ? ', '
                                  : ''
                              }`
                          )}
                        </Fragment>
                      ))}
                    </p>

                    <p className="truncate text-sm font-medium text-gray-500">
                      {item.metadata?.date
                        ? format(parseISO(item.metadata.date), 'MM/dd/yyyy')
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
