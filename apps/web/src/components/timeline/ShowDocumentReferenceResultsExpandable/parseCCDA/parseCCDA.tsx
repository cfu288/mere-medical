import {
  CCDAStructureDefinition2_1,
  CCDAStructureDefinitionKeys2_1,
} from '../CCDAStructureDefinitionKeys2_1';
import parse from 'date-fns/parse';
import {
  DisplayCCDAResultsSection,
  parseCCDAResultsSection,
} from './parseCCDAResultsSection';
import { parseCCDAVitalsSection } from './parseCCDAVitalsSection';
import { parseCCDAHPISection } from './parseCCDAHPISection';

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
    switch (k) {
      case 'VITAL_SIGNS_SECTION':
        parsedDoc[k] = parseCCDAVitalsSection(sections, val) as JSX.Element;
        break;
      case 'RESULTS_SECTION':
        const listComponents = parseCCDAResultsSection(sections, val);
        if (listComponents) {
          parsedDoc[k] = (
            <DisplayCCDAResultsSection listComponents={listComponents} />
          );
        }
        break;
      case 'HISTORY_OF_PRESENT_ILLNESS_SECTION':
        parsedDoc[k] = parseCCDAHPISection(sections, val) as JSX.Element;
        break;
      default:
        parsedDoc[k] = parseCCDASection(sections, val);
        break;
    }
  }

  return parsedDoc;
}

export function parseDateString(d: string) {
  let format = '';
  switch (d.length) {
    case 8:
      format = 'yyyyMMdd';
      break;
    case 13:
      format = 'yyyyMMddxx';
      break;
    case 10:
      format = 'yyyyMMddHH';
      break;
    case 15:
      format = 'yyyyMMddHHxx';
      break;
    case 12:
      format = 'yyyyMMddHHmm';
      break;
    case 17:
      format = 'yyyyMMddHHmmxx';
      break;
    case 14:
      format = 'yyyyMMddHHmmss';
      break;
    case 19:
      format = 'yyyyMMddHHmmssxx';
      break;
    default:
      throw new Error('Invalid date format');
  }
  const date = parse(d, format, new Date());
  return date.toLocaleString();
}

export function getMatchingSections(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  return [...(sections as unknown as HTMLElement[])]?.filter((s) =>
    Array.isArray(id)
      ? id.includes(
          s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') || ''
        )
      : s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') === id
  );
}

export function parseCCDASection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  const matchingSections = getMatchingSections(sections, id);

  return [...(matchingSections as unknown as HTMLElement[])]
    ?.map((x) => x.innerHTML)
    .flat()
    .join();
}
