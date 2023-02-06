import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { format, parseISO } from 'date-fns';
import { AllergyIntolerance, BundleEntry } from 'fhir/r2';
import { Fragment } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { TimelineCardBase } from '../timeline/TimelineCardBase';

export function AllergyIntoleranceListCard({
  items,
}: {
  items: ClinicalDocument<BundleEntry<AllergyIntolerance>>[];
}) {
  if (items.length === 0) return null;
  return (
    <Disclosure defaultOpen={true} key={items.map((i) => i.id).join('.')}>
      {({ open }) => (
        <Fragment key={`s=${items.map((i) => i.id).join('.')}`}>
          <Disclosure.Button className="w-full font-bold">
            <div className="flex w-full items-center justify-between py-6 text-xl font-extrabold">
              Allergies
              <ChevronDownIcon
                className={` h-8 w-8 ${open ? 'rotate-180 transform' : ''}`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel>
            <TimelineCardBase>
              <div className="min-w-0 flex-1 shrink">
                <span className="absolute inset-0" aria-hidden="true" />
                {items.map((item) => (
                  <div className="py-2" key={item.id}>
                    <p className="text-sm font-bold text-gray-900 md:text-base">
                      {item.data_record.raw.resource?.substance.text}{' '}
                      {item.data_record.raw.resource?.reaction &&
                        item.data_record.raw.resource?.reaction?.length &&
                        ' - '}
                      {item.data_record.raw.resource?.reaction?.map((rxn) => (
                        <Fragment key={rxn.id}>
                          {rxn.manifestation.map((man, i) => (
                            <Fragment key={man.id}>
                              {`${man.text}${
                                i < (rxn.manifestation?.length - 1 || 0)
                                  ? ', '
                                  : ''
                              }`}
                            </Fragment>
                          ))}
                        </Fragment>
                      ))}
                    </p>
                    <p className="truncate text-xs font-medium text-gray-500 md:text-sm">
                      {item.metadata?.date
                        ? format(parseISO(item.metadata.date), 'MM/dd/yyyy')
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            </TimelineCardBase>
          </Disclosure.Panel>
        </Fragment>
      )}
    </Disclosure>
  );
}
