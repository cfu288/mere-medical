/* eslint-disable no-case-declarations */
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
import {
  DisplayCCDASocialHistorySection,
  parseCCDASocialHistorySection,
} from './parseCCDASocialHistorySection';
import {
  DisplayCCDAAssesmentSection,
  parseCCDAAssesmentSection,
} from './parseCCDAAssesmentSection';
import {
  DisplayCCDAEncounterSection,
  parseCCDAEncounterSection,
} from './parseCCDAEncounterSection';
import {
  DisplayCCDACareTeamSection,
  parseCCDACareTeamSection,
} from './parseCCDACareTeamSection';
import {
  parseCCDAPlanOfTreatmentSection,
  DisplayCCDAPlanOfTreatmentSection,
} from './parseCCDAPlanOfTreatmentSection';

export function parseCCDA(
  raw: string,
  forceRawStringResponse = false,
): Partial<Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(raw, 'text/xml');
  const sections = xmlDoc.getElementsByTagName('section');
  const parsedDoc: Partial<
    Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>
  > = {};

  for (const [key, val] of Object.entries(CCDAStructureDefinition2_1)) {
    const k = key as CCDAStructureDefinitionKeys2_1;
    if (forceRawStringResponse) {
      parsedDoc[k] = parseCCDASection(sections, val);
    } else {
      switch (k) {
        case 'VITAL_SIGNS_SECTION':
          try {
            parsedDoc[k] = parseCCDAVitalsSection(sections, val) as JSX.Element;
          } catch (e) {
            console.error(e);
            parsedDoc[k] = parseCCDASection(sections, val);
          }
          break;
        case 'RESULTS_SECTION':
          try {
            const listComponents = parseCCDAResultsSection(sections, val);
            if (listComponents) {
              parsedDoc[k] = (
                <DisplayCCDAResultsSection listComponents={listComponents} />
              );
            }
          } catch (e) {
            console.error(e);
            parsedDoc[k] = parseCCDASection(sections, val);
          }
          break;
        case 'HISTORY_OF_PRESENT_ILLNESS_SECTION':
          try {
            parsedDoc[k] = parseCCDAHPISection(sections, val) as JSX.Element;
          } catch (e) {
            console.error(e);
            parsedDoc[k] = parseCCDASection(sections, val);
          }
          break;
        case 'SOCIAL_HISTORY_SECTION':
          try {
            const socialData = parseCCDASocialHistorySection(sections, val);
            if (socialData) {
              parsedDoc[k] = (
                <DisplayCCDASocialHistorySection
                  data={socialData.data}
                  uniqueDates={socialData.uniqueDates}
                />
              );
            }
          } catch (e) {
            console.error(e);
            parsedDoc[k] = parseCCDASection(sections, val);
          }
          break;
        case 'ASSESSMENT_SECTION':
          try {
            const assData = parseCCDAAssesmentSection(sections, val);
            if (assData) {
              parsedDoc[k] = <DisplayCCDAAssesmentSection data={assData} />;
            }
          } catch (e) {
            console.error(e);
            parsedDoc[k] = parseCCDASection(sections, val);
          }
          break;
        case 'CARE_TEAMS_SECTION':
          try {
            const careTeamData = parseCCDACareTeamSection(sections, val);
            if (careTeamData) {
              parsedDoc[k] = <DisplayCCDACareTeamSection data={careTeamData} />;
            }
          } catch (e) {
            console.error(e);
            parsedDoc[k] = parseCCDASection(sections, val);
          }
          break;
        case 'ENCOUNTERS_SECTION':
          try {
            const encData = parseCCDAEncounterSection(sections, val);
            if (encData) {
              parsedDoc[k] = <DisplayCCDAEncounterSection data={encData} />;
            }
          } catch (e) {
            console.error(e);
            parsedDoc[k] = parseCCDASection(sections, val);
          }
          break;
        case 'PLAN_OF_TREATMENT_SECTION':
          try {
            const planOfTreatment = parseCCDAPlanOfTreatmentSection(
              sections,
              val,
            );
            if (planOfTreatment) {
              parsedDoc[k] = (
                <DisplayCCDAPlanOfTreatmentSection data={planOfTreatment} />
              );
            }
          } catch (e) {
            console.error(e);
            parsedDoc[k] = parseCCDASection(sections, val);
          }
          break;
        default:
          const result = parseCCDASection(sections, val);
          // console.log(result);
          parsedDoc[k] = result;
          break;
      }
    }
  }

  return parsedDoc;
}

export function parseCCDARaw(
  raw: string,
): Partial<Record<CCDAStructureDefinitionKeys2_1, string>> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(raw, 'text/xml');
  const sections = xmlDoc.getElementsByTagName('section');
  const parsedDoc: Partial<Record<CCDAStructureDefinitionKeys2_1, string>> = {};

  for (const [key, val] of Object.entries(CCDAStructureDefinition2_1)) {
    const k = key as CCDAStructureDefinitionKeys2_1;
    const result = parseCCDASection(sections, val);
    parsedDoc[k] = result;
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
  id: string[] | string,
) {
  return [...(sections as unknown as HTMLElement[])]?.filter((s) =>
    Array.isArray(id)
      ? id.includes(
          s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ||
            '',
        )
      : s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') === id,
  );
}

export function parseCCDASection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string,
) {
  const matchingSections = getMatchingSections(sections, id);

  try {
    const res = [...(matchingSections as unknown as HTMLElement[])];
    // try and parse <text> elements
    const text = res?.map((x) => x.getElementsByTagName('text')?.[0])?.[0]
      ?.innerHTML;

    return text;
  } catch (e) {
    const res = [...(matchingSections as unknown as HTMLElement[])];

    return res
      ?.map((x) => x.innerHTML)
      .flat()
      .join();
  }
}
