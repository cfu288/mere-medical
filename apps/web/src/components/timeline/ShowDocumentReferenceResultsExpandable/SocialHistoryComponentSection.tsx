import { parseDateString } from './parseCCDA/parseCCDA';
import { CCDASocialHistoryItem } from './parseCCDA/parseCCDASocialHistorySection';

export function SocialHistoryComponentSection({
  data,
  uniqueDates,
}: {
  data: Record<string, CCDASocialHistoryItem>;
  uniqueDates: Set<string | null>;
}) {
  return (
    <>
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
            <>
              <tr key={v.value + v.title}>
                <td className="break-word py-1 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                  {v.title}
                </td>
                <td className={`break-word px-3 py-1 text-sm text-gray-900 `}>
                  {v.value}
                </td>
              </tr>
              <tr>
                {v.entityRelationships && (
                  <table className="min-w-full divide-y divide-gray-300 rounded border">
                    <tbody className="divide-y divide-gray-200">
                      {Object.values(v.entityRelationships).map((q) => (
                        <>
                          <tr key={q.value + q.title}>
                            <td className="break-word py-1 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                              {q.title}
                            </td>
                            <td
                              className={`break-word px-3 py-1 text-sm text-gray-900 `}
                            >
                              {q.value}
                            </td>
                          </tr>
                          <tr>
                            {q.entityRelationships && (
                              <table className="min-w-full divide-y divide-gray-300 rounded border">
                                <tbody className="divide-y divide-gray-200">
                                  {Object.values(q.entityRelationships).map(
                                    (r) => (
                                      <tr key={r.value + r.title}>
                                        <td className="break-word py-1 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                                          {r.title}
                                        </td>
                                        <td
                                          className={`break-word px-3 py-1 text-sm text-gray-900 `}
                                        >
                                          {r.value}
                                        </td>
                                      </tr>
                                    )
                                  )}
                                </tbody>
                              </table>
                            )}
                          </tr>
                        </>
                      ))}
                    </tbody>
                  </table>
                )}
              </tr>
            </>
          ))}
        </tbody>
      </table>
      <p className="mt-2 mb-4 text-sm font-semibold italic text-gray-900">
        {uniqueDates.size > 0 &&
          `Results taken at ${[...uniqueDates]
            .filter((d): d is string => Boolean(d))
            .map(parseDateString)
            .join('; ')}`}
      </p>
    </>
  );
}
