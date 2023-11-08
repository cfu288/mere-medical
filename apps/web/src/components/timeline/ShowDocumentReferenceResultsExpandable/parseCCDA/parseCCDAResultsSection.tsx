import { ResultComponentSection } from '../ResultComponentSection';
import { LOINC_CODE_SYSTEM } from '../ShowDocumentReferenceResultsExpandable';
import { getMatchingSections } from './parseCCDA';

export function parseCCDAResultsSection(
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
      ?.map((z) => [...z]?.[0]?.textContent)
  )?.[0];

  const sectionComponents = [
    ...(matchingSections as unknown as HTMLElement[]),
  ]?.map((e) =>
    [...e.getElementsByTagName('entry')].map((x) =>
      x.getElementsByTagName('component')
    )
  );

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
