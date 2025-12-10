import uuid4 from '../../../../../shared/utils/UUIDUtils';
import { ResultComponentSection } from '../ResultComponentSection';
import { LOINC_CODE_SYSTEM } from '../ShowDocumentReferenceAttachmentExpandable';
import { getMatchingSections } from './parseCCDA';

export function parseCCDAResultsSection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string,
) {
  const matchingSections = getMatchingSections(sections, id);

  if (!matchingSections || matchingSections?.length === 0) {
    return null;
  }

  const matchingSectionsDisplayNames = [
    ...matchingSections.map((x) => x.getElementsByTagName('entry')),
  ]?.map((x) =>
    [...x]
      .map((y) => y.getElementsByTagName('code'))
      ?.map((z) => {
        const firstEl = [...z]?.[0];
        if (firstEl.getAttribute('displayName')) {
          return firstEl.getAttribute('displayName');
        }
        return firstEl.textContent?.trim();
      }),
  )?.[0];

  const sectionComponents = [
    ...(matchingSections as unknown as HTMLElement[]),
  ]?.map((e) =>
    [...e.getElementsByTagName('entry')].map((x) =>
      x.getElementsByTagName('component'),
    ),
  );

  if (!sectionComponents || sectionComponents?.length === 0) {
    return null;
  }

  const listComponents = [];

  for (const components of sectionComponents) {
    for (const [index, components1] of [...components].entries()) {
      const data: Record<string, CCDAResultItem> = {};
      for (const component of components1) {
        const codeId = component
          ?.getElementsByTagName('code')[0]
          ?.getAttribute('code');
        const codeSystem = component
          ?.getElementsByTagName('code')[0]
          ?.getAttribute('codeSystem');
        const codeDisplayName =
          component
            ?.getElementsByTagName('code')[0]
            ?.getAttribute('displayName') ||
          component
            ?.getElementsByTagName('originalText')?.[0]
            ?.textContent?.trim() ||
          '';
        const uCodeId = (
          codeId ||
          codeDisplayName ||
          `missing-${uuid4()}`
        )?.trim();
        // if (codeSystem === LOINC_CODE_SYSTEM && codeId) {
        data[uCodeId] = {
          title: codeDisplayName,
          value:
            component
              ?.getElementsByTagName('value')?.[0]
              ?.getAttribute('value') ||
            component
              ?.getElementsByTagName('value')?.[0]
              ?.getAttribute('displayName') ||
            component
              ?.getElementsByTagName('value')?.[0]
              ?.textContent?.trim() ||
            matchingSections?.[0]
              ?.getElementsByTagName('text')?.[0]
              ?.querySelector(
                `[*|ID='${component
                  ?.getElementsByTagName('value')?.[0]
                  ?.getElementsByTagName('reference')?.[0]
                  ?.getAttribute('value')
                  ?.replace('#', '')}']`,
              )
              ?.textContent?.trim() ||
            '',
          unit:
            component
              ?.getElementsByTagName('value')?.[0]
              ?.getAttribute('unit') || '',
          datetime:
            component
              ?.getElementsByTagName('effectiveTime')?.[0]
              ?.getAttribute('value') || '',
          datetimeLow:
            component
              ?.getElementsByTagName('effectiveTime')?.[0]
              ?.getElementsByTagName('low')?.[0]
              ?.getAttribute('value') || '',
          datetimeHigh:
            component
              ?.getElementsByTagName('effectiveTime')?.[0]
              ?.getElementsByTagName('high')?.[0]
              ?.getAttribute('value') || '',
          referenceRangeText:
            component
              ?.getElementsByTagName('referenceRange')?.[0]
              ?.getElementsByTagName('text')?.[0]
              ?.textContent?.trim() || '',
          referenceRangeTextItems: [
            ...(component?.getElementsByTagName('referenceRange') || []),
          ].map(
            (x) =>
              x?.getElementsByTagName('text')?.[0]?.textContent?.trim() || '',
          ),
          referenceRangeLow:
            component
              ?.getElementsByTagName('referenceRange')?.[0]
              ?.getElementsByTagName('low')?.[0]
              ?.getAttribute('value') || '',
          referenceRangeHigh:
            component
              ?.getElementsByTagName('referenceRange')?.[0]
              ?.getElementsByTagName('high')?.[0]
              ?.getAttribute('value') || '',
        };
        data[uCodeId] = {
          ...data[uCodeId],
          isOutOfRange:
            data[uCodeId].value &&
            data[uCodeId].referenceRangeLow &&
            data[uCodeId].referenceRangeHigh &&
            (parseFloat(data[uCodeId].value || '') <
              parseFloat(data[uCodeId].referenceRangeLow || '') ||
              parseFloat(data[uCodeId].value || '') >
                parseFloat(data[uCodeId].referenceRangeHigh || '')),
        };
      }
      // }
      const uniqueDates = new Set([
        ...Object.values(data)
          .map((v) => v.datetime)
          .filter((v) => v && v?.length > 0),
        ...Object.values(data)
          .map((v) => v.datetimeLow)
          .filter((v) => v && v?.length > 0),
        ...Object.values(data)
          .map((v) => v.datetimeHigh)
          .filter((v) => v && v?.length > 0),
      ]);

      listComponents.push({
        title: matchingSectionsDisplayNames[index] || '',
        data,
        uniqueDates,
      });
    }
  }

  return listComponents;
}
export interface CCDAResultItem {
  title: string;
  value: string | null;
  unit: string | null;
  datetime: string | null;
  datetimeLow: string | null;
  datetimeHigh: string | null;
  referenceRangeLow: string | null;
  referenceRangeHigh: string | null;
  referenceRangeText: string | null;
  referenceRangeTextItems: string[];
  isOutOfRange?: boolean | '' | null | undefined;
}

export function DisplayCCDAResultsSection({
  listComponents,
}: {
  listComponents: {
    title: string | null;
    data: Record<string, CCDAResultItem>;
    uniqueDates: Set<string | null>;
  }[];
}) {
  return (
    <>
      {listComponents.map((c) => (
        <ResultComponentSection
          matchingSectionsDisplayName={c.title as string}
          data={c.data}
          uniqueDates={c.uniqueDates}
        />
      ))}
    </>
  );
}
