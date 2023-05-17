import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { format, parseISO } from 'date-fns';
import { BundleEntry, Immunization } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { CardBase } from '../connection/CardBase';

function getVaccineCode(item: ClinicalDocument<BundleEntry<Immunization>>) {
  let code = item.data_record.raw.resource?.vaccineCode?.coding?.filter((i) =>
    i.system?.endsWith('cvx')
  )?.[0];
  if (!code) {
    code = item.data_record.raw.resource?.vaccineCode?.coding?.filter((i) =>
      i.system?.endsWith('ndc')
    )?.[0];
  }
  return code?.code || '';
}

function groupBy<T, U>(list: T[], keyGetter: (arg: T) => U): Map<U, T[]> {
  const map = new Map();
  list.forEach((item) => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return map;
}

export function ImmunizationListCard({
  items,
}: {
  items: ClinicalDocument<BundleEntry<Immunization>>[];
}) {
  if (items.length === 0) return null;
  const sortItems = groupBy<
    ClinicalDocument<BundleEntry<Immunization>>,
    string
  >(items, getVaccineCode);

  return (
    <Disclosure defaultOpen={true}>
      {({ open }) => (
        <>
          <Disclosure.Button className="w-full font-bold">
            <div className="flex w-full items-center justify-between py-6 text-xl font-extrabold">
              Immunizations
              <ChevronDownIcon
                className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                  open ? 'rotate-180 transform' : ''
                }`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="">
            <CardBase>
              <div className="min-w-0 flex-1">
                {[...sortItems.entries()].map(([key, item]) => (
                  <div className="py-2" key={item?.[0].id}>
                    <p className="text-sm font-bold text-gray-900 md:text-base">
                      {item?.[0].metadata?.display_name}
                    </p>
                    <ul className="truncate pl-2 text-sm font-medium text-gray-500">
                      {item.map((x) => (
                        <li key={x.id}>
                          {`• ${
                            x.metadata?.date
                              ? format(parseISO(x.metadata.date), 'MM/dd/yyyy')
                              : ''
                          }
                    `}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardBase>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
