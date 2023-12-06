import { LOINC_CODE_SYSTEM } from '../ShowDocumentReferenceResultsExpandable';
import { getMatchingSections, parseDateString } from './parseCCDA';

export function parseCCDAVitalsSection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  const matchingSections = getMatchingSections(sections, id);

  if (!matchingSections) {
    return null;
  }

  const matchingSectionsDisplayNames = [
    ...matchingSections.map((x) => x.getElementsByTagName('entry')),
  ]?.map((x) =>
    [...x]
      .map((y) => y.getElementsByTagName('code'))
      ?.map(
        (z) =>
          [...z]?.[0]?.getAttribute('displayName') || [...z]?.[0]?.textContent
      )
  )?.[0];

  const sectionComponents = [
    ...(matchingSections as unknown as HTMLElement[]),
  ]?.map((e) =>
    [...e.getElementsByTagName('entry')].map((x) =>
      x.getElementsByTagName('component')
    )
  )?.[0];

  if (!sectionComponents) {
    return null;
  }

  const extractedVital: Record<
    string,
    {
      title: string;
      value: string | null;
      unit: string | null;
      datetime: string | null;
      statusCode: string | null;
    }
  > = {};
  for (const components of sectionComponents) {
    for (const [index, component] of [...components].entries()) {
      const codeId = component
        ?.getElementsByTagName('code')[0]
        .getAttribute('code');
      const codeSystem = component
        ?.getElementsByTagName('code')[0]
        .getAttribute('codeSystem');
      const codeDisplayName = component
        ?.getElementsByTagName('code')[0]
        .getAttribute('displayName');
      if (codeSystem === LOINC_CODE_SYSTEM && codeId) {
        extractedVital[codeId] = {
          title:
            codeDisplayName ||
            component?.getElementsByTagName('originalText')?.[0]?.innerHTML,
          value:
            component
              ?.getElementsByTagName('value')?.[0]
              ?.getAttribute('value') ||
            component
              ?.getElementsByTagName('value')?.[0]
              ?.getAttribute('displayName'),
          unit: component
            ?.getElementsByTagName('value')?.[0]
            ?.getAttribute('unit'),
          datetime: component
            ?.getElementsByTagName('effectiveTime')?.[0]
            ?.getAttribute('value'),
          statusCode: component
            ?.getElementsByTagName('statusCode')?.[0]
            ?.getAttribute('code'),
        };
      }
    }
  }
  const uniqueDates = new Set([
    ...Object.values(extractedVital).map((v) => v.datetime),
  ]);

  return (
    <>
      <table className="min-w-full table-auto divide-y divide-gray-300 sm:table-auto">
        <thead>
          <tr>
            <th
              scope="col"
              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:w-auto sm:pl-0"
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
          {Object.values(extractedVital).map((v) => (
            <tr key={v.value}>
              <td className="break-word py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                {v.title}
              </td>
              <td className="break-word px-3 py-4 text-sm text-gray-900">
                {v.value}
                {v.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 mb-4 text-sm font-semibold italic text-gray-900">
        Vitals taken at{' '}
        {[...uniqueDates]
          .filter((d): d is string => Boolean(d))
          .map(parseDateString)
          .join(' ,')}
      </p>
    </>
  );
}
