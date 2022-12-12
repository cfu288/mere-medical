import { BundleEntry, CarePlan } from 'fhir/r2';
import { Fragment } from 'react';
import { ClinicalDocument } from '../models/ClinicalDocument';

export function CarePlanListCard({
  items,
}: {
  items: ClinicalDocument<BundleEntry<CarePlan>>[];
}) {
  if (
    items.length === 0 ||
    items?.[0]?.data_record.raw.resource?.goal === undefined ||
    items?.[0]?.data_record.raw.resource?.goal?.length === undefined
  )
    return null;
  return (
    <>
      <div className="py-6 text-xl font-extrabold">Care Plan</div>
      <div className="focus-within:ring-primary-500 relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-offset-2 hover:border-gray-400 ">
        <div className="min-w-0 flex-1">
          <span className="absolute inset-0" aria-hidden="true" />
          {items.map((item) => (
            <Fragment key={item.metadata?.id}>
              {item.data_record.raw.resource?.goal &&
                item.data_record.raw.resource?.goal?.length !== 0 && (
                  <div className="py-2">
                    {item.data_record.raw.resource?.addresses?.map((item) => (
                      <p key={item.id} className="font-bold text-gray-800">
                        {item.display}
                      </p>
                    ))}
                    <ul>
                      {item.data_record.raw.resource?.goal?.map((item) => (
                        <li
                          key={item.id}
                          className="pl-4 text-base text-gray-600"
                        >
                          {' -    '}
                          {item.display}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}
