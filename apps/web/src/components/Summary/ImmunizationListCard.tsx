import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { format, parseISO } from 'date-fns';
import { BundleEntry, Immunization } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument';

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
  // const sortItems = items.sort((a, b) => {
  //   return getVaccineCode(a).localeCompare(getVaccineCode(b));
  // });
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
                className={` h-8 w-8 ${open ? 'rotate-180 transform' : ''}`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="">
            <div className="focus-within:ring-primary-500 focus:ring-primary-700 relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm focus-within:ring-2  focus-within:ring-offset-2">
              <div className="min-w-0 flex-1">
                <span className="absolute inset-0" aria-hidden="true" />
                {[...sortItems.entries()].map(([key, item]) => (
                  <div className="py-2" key={item?.[0]._id}>
                    <p className="text-md font-bold text-gray-900">
                      {item?.[0].metadata?.display_name}
                    </p>
                    <ul className="truncate pl-2 text-sm font-medium text-gray-500">
                      {item.map((x) => (
                        <li>
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
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
