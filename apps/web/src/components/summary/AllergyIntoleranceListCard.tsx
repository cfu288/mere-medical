import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { format, parseISO } from 'date-fns';
import { AllergyIntolerance, BundleEntry } from 'fhir/r2';
import { Fragment } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { CardBase } from '../connection/CardBase';
import * as fhirpath from 'fhirpath';

function getAllergyText(
  item: ClinicalDocument<BundleEntry<AllergyIntolerance>>
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'substance.text'
  )?.[0];
}

function hasAllergyReactions(
  item: ClinicalDocument<BundleEntry<AllergyIntolerance>>
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'reaction.exists()'
  )?.[0];
}

function getAllergyReactions(
  item: ClinicalDocument<BundleEntry<AllergyIntolerance>>
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'reaction.manifestation.text'
  );
}

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
                className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                  open ? 'rotate-180 transform' : ''
                }`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel>
            <CardBase>
              <div className="min-w-0 flex-1 shrink">
                {items.map((item) => (
                  <div className="py-2" key={item.id}>
                    <p className="text-sm font-bold text-gray-900 md:text-base">
                      {getAllergyText(item)}{' '}
                      {hasAllergyReactions(item) && ' - '}
                      {getAllergyReactions(item).map((man, i, arr) => (
                        <Fragment key={man}>
                          {`${man}${i < (arr.length - 1 || 0) ? ', ' : ''}`}
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
            </CardBase>
          </Disclosure.Panel>
        </Fragment>
      )}
    </Disclosure>
  );
}
