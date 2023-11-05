import {
  CCDAStructureDefinition2_1,
  CCDAStructureDefinitionKeys2_1,
} from './CCDAStructureDefinitionKeys2_1';
import { ResultComponentSection } from './ResultComponentSection';
import { LOINC_CODE_SYSTEM } from './ShowDocumentReferenceResultsExpandable';

export function parseCCDA(
  raw: string
): Partial<Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(raw, 'text/xml');
  const sections = xmlDoc.getElementsByTagName('section');
  const parsedDoc: Partial<
    Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>
  > = {};

  for (const [key, val] of Object.entries(CCDAStructureDefinition2_1)) {
    const k = key as CCDAStructureDefinitionKeys2_1;
    if (k === 'VITAL_SIGNS_SECTION') {
      parsedDoc[k] = parseCCDAVitalsSection(sections, val) as JSX.Element;
    } else if (k === 'RESULTS_SECTION') {
      parsedDoc[k] = parseCCDAResultsSection(sections, val) as JSX.Element;
    } else {
      parsedDoc[k] = parseCCDASection(sections, val);
    }
  }

  return parsedDoc;
}

export function parseDateString(d: string) {
  const year = d.substring(0, 4);
  const month = d.substring(4, 6);
  const day = d.length > 6 ? d.substring(6, 8) : '00';
  // hours need conditional check for length
  const hour = d.length > 8 ? d.substring(8, 10) : '00';
  // minutes need conditional check for length
  const minute = d.length > 10 ? d.substring(10, 12) : '00';
  // seconds need conditional check for length
  const second = d.length > 12 ? d.substring(12, 14) : '00';
  const offset = d.substring(14);
  const date = new Date(
    Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    )
  );
  // conditionally subtract offset from date to handle dates missing +0000
  if (offset) {
    const offsetHours = parseInt(offset.substring(0, 3));
    const offsetMinutes = parseInt(offset.substring(3));
    date.setHours(date.getHours() - offsetHours);
    date.setMinutes(date.getMinutes() - offsetMinutes);
  }

  return date.toLocaleString();
}

export function parseCCDAResultsSection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  const matchingSections = [...(sections as unknown as HTMLElement[])]?.filter(
    (s) =>
      Array.isArray(id)
        ? id.includes(
            s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ||
              ''
          )
        : s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ===
          id
  );

  if (!matchingSections) {
    return null;
  }

  console.log(
    [...matchingSections.map((x) => x.getElementsByTagName('entry'))]?.map(
      (x) =>
        [...x]
          .map((y) => y.getElementsByTagName('code'))
          ?.map((z) => [...z]?.[0]?.textContent)
    )
  );

  const matchingSectionsDisplayNames = [
    ...matchingSections.map((x) => x.getElementsByTagName('entry')),
  ]?.map((x) =>
    [...x]
      .map((y) => y.getElementsByTagName('code'))
      ?.map((z) => [...z]?.[0]?.textContent)
  )?.[0];

  const sectionComponents = [
    ...(matchingSections as unknown as HTMLElement[]),
  ]?.map((e) =>
    [...e.getElementsByTagName('entry')].map((x) =>
      x.getElementsByTagName('component')
    )
  );

  console.log(sectionComponents);

  if (!sectionComponents || sectionComponents.length === 0) {
    return null;
  }

  const listComponents = [];

  for (const components of sectionComponents) {
    for (const [index, components1] of [...components].entries()) {
      const kp: Record<
        string,
        {
          title: string;
          value: string | null;
          unit: string | null;
          datetime: string | null;
          datetimeLow: string | null;
          datetimeHigh: string | null;
          referenceRangeLow: string | null;
          referenceRangeHigh: string | null;
          referenceRangeText: string | null;
          isOutOfRange?: boolean | '' | null;
        }
      > = {};
      for (const component of components1) {
        const codeId = component
          ?.getElementsByTagName('code')[0]
          .getAttribute('code');
        const codeSystem = component
          ?.getElementsByTagName('code')[0]
          .getAttribute('codeSystem');
        const codeDisplayName =
          component
            ?.getElementsByTagName('code')[0]
            .getAttribute('displayName') ||
          component?.getElementsByTagName('originalText')?.[0]?.textContent ||
          '';
        if (codeSystem === LOINC_CODE_SYSTEM && codeId) {
          kp[codeId] = {
            title: codeDisplayName,
            value:
              component
                ?.getElementsByTagName('value')?.[0]
                ?.getAttribute('value') ||
              component
                ?.getElementsByTagName('value')?.[0]
                ?.getAttribute('displayName') ||
              component?.getElementsByTagName('value')?.[0]?.textContent,
            unit: component
              ?.getElementsByTagName('value')?.[0]
              ?.getAttribute('unit'),
            datetime: component
              ?.getElementsByTagName('effectiveTime')?.[0]
              ?.getAttribute('value'),
            datetimeLow: component
              ?.getElementsByTagName('effectiveTime')?.[0]
              ?.getElementsByTagName('low')?.[0]
              ?.getAttribute('value'),
            datetimeHigh: component
              ?.getElementsByTagName('effectiveTime')?.[0]
              ?.getElementsByTagName('high')?.[0]
              ?.getAttribute('value'),
            referenceRangeText: component
              ?.getElementsByTagName('referenceRange')?.[0]
              ?.getElementsByTagName('text')?.[0]?.textContent,
            referenceRangeLow: component
              ?.getElementsByTagName('referenceRange')?.[0]
              ?.getElementsByTagName('low')?.[0]
              ?.getAttribute('value'),
            referenceRangeHigh: component
              ?.getElementsByTagName('referenceRange')?.[0]
              ?.getElementsByTagName('high')?.[0]
              ?.getAttribute('value'),
          };
          kp[codeId] = {
            ...kp[codeId],
            isOutOfRange:
              kp[codeId].value &&
              kp[codeId].referenceRangeLow &&
              kp[codeId].referenceRangeHigh &&
              (parseFloat(kp[codeId].value || '') <
                parseFloat(kp[codeId].referenceRangeLow || '') ||
                parseFloat(kp[codeId].value || '') >
                  parseFloat(kp[codeId].referenceRangeHigh || '')),
          };
        }
      }
      const uniqueDates = new Set([
        ...Object.values(kp).map((v) => v.datetime),
        ...Object.values(kp).map((v) => v.datetimeLow),
        ...Object.values(kp).map((v) => v.datetimeHigh),
      ]);

      listComponents.push({
        title: matchingSectionsDisplayNames[index],
        kp,
        uniqueDates,
      });
    }
  }

  return (
    <>
      {listComponents.map((c) => (
        <ResultComponentSection
          matchingSectionsDisplayName={c.title as string}
          kp={c.kp}
          uniqueDates={c.uniqueDates}
        />
      ))}
    </>
  );
}

export function parseCCDAVitalsSection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  const matchingSections = [...(sections as unknown as HTMLElement[])]?.filter(
    (s) =>
      Array.isArray(id)
        ? id.includes(
            s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ||
              ''
          )
        : s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ===
          id
  );
  if (!matchingSections) {
    return null;
  }

  const components = [...(matchingSections as unknown as HTMLElement[])]?.map(
    (e) => e?.getElementsByTagName('component')
  )?.[0];

  if (!components) {
    return null;
  }

  const kp: Record<
    string,
    {
      title: string;
      value: string | null;
      unit: string | null;
      datetime: string | null;
    }
  > = {};
  for (const component of components) {
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
      kp[codeId] = {
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
      };
    }
  }

  const uniqueDates = new Set([...Object.values(kp).map((v) => v.datetime)]);

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
          {Object.values(kp).map((v) => (
            <tr>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                {v.title}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
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
          .filter((d) => !!d)
          .map((d) => {
            d = d!;
            return parseDateString(d);
          })
          .join(' ,')}
      </p>
    </>
  );
}

export function parseCCDASection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  const matchingSections = [...(sections as unknown as HTMLElement[])]?.filter(
    (s) =>
      Array.isArray(id)
        ? id.includes(
            s.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ||
              ''
          )
        : s.getElementsByTagName('templateId')?.[0]?.getAttribute('root') === id
  );

  return [...(matchingSections as unknown as HTMLElement[])]
    ?.map((x) => x.innerHTML)
    .flat()
    .join();
}
