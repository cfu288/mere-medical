import { Disclosure } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { parseDateString } from './parseCCDA/parseCCDA';
import { CCDAResultItem } from './parseCCDA/parseCCDAResultsSection';

export function ResultComponentSection({
  matchingSectionsDisplayName,
  data,
  uniqueDates,
}: {
  matchingSectionsDisplayName: string;
  data: Record<string, CCDAResultItem>;
  uniqueDates: Set<string | null>;
}) {
  return (
    <Disclosure>
      {({ open }) => (
        <>
          <Disclosure.Button className="mb-1 w-full rounded-md bg-gray-50 p-1 font-bold">
            <div className="flex w-full items-center justify-between text-left">
              {matchingSectionsDisplayName}
              <ChevronRightIcon
                className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                  open ? 'rotate-90 transform' : ''
                }`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="m-1 text-sm text-gray-700">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
                  >
                    Title
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
                  >
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Object.values(data).map((v) => (
                  <tr key={v.value + v.title}>
                    <td className="break-word py-1 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                      {v.title}
                      <p className="col-span-3 self-center text-xs font-light text-gray-600">
                        {v.referenceRangeLow && v.referenceRangeHigh
                          ? `Range: ${v.referenceRangeLow}${v.unit || ''} - ${
                              v.referenceRangeHigh
                            }${v.unit || ''}`
                          : v.referenceRangeText
                          ? `Range: ${v.referenceRangeText}`
                          : ''}
                      </p>
                    </td>
                    <td
                      className={`break-word px-3 py-1 text-sm text-gray-900 ${
                        v.isOutOfRange ? 'text-red-700' : ''
                      }`}
                    >
                      {v.value}
                      {v.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 mb-4 text-sm font-semibold italic text-gray-900">
              {uniqueDates.size > 0 &&
                `Results taken at ${[...uniqueDates]
                  .filter((d): d is string => Boolean(d))
                  .map(parseDateString)
                  .join(' ,')}`}
            </p>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
