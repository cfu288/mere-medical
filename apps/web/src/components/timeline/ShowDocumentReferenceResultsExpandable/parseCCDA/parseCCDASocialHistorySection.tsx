import {
  LOINC_CODE_SYSTEM,
  SNOMED_CT_CODE_SYSTEM,
} from '../ShowDocumentReferenceResultsExpandable';
import { SocialHistoryComponentSection } from '../SocialHistoryComponentSection';
import { getMatchingSections } from './parseCCDA';

export function parseCCDASocialHistorySection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  const matchingSections = getMatchingSections(sections, id);
  if (!matchingSections) {
    return null;
  }

  const sectionEntries = [
    ...(matchingSections as unknown as HTMLElement[]),
  ]?.map((e) => [...e.getElementsByTagName('entry')]);
  if (!sectionEntries) {
    return null;
  }

  const extractedSocialHistory: Record<string, CCDASocialHistoryItem> =
    extractSocialHistoryWithEntityRelationships(
      sectionEntries?.[0],
      matchingSections?.[0]
    );

  const uniqueDates = new Set([
    ...Object.values(extractedSocialHistory).map((v) => v.datetime),
  ]);

  return {
    data: extractedSocialHistory,
    uniqueDates,
  };
}

function extractSocialHistoryWithEntityRelationships(
  sectionEntries: Element[],
  matchingSections: HTMLElement
) {
  const extractedSocialHistory: Record<string, CCDASocialHistoryItem> = {};
  for (const component of sectionEntries) {
    const { codeId, codeDisplayName } =
      getCodeIdSystemAndDisplayName(component);
    const uCodeId = (codeId || codeDisplayName || '')?.trim();
    if (uCodeId !== '') {
      if (!extractedSocialHistory[uCodeId]) {
        extractedSocialHistory[uCodeId] = extractCCDASocialHistoryItemFromEntry(
          {
            codeDisplayName,
            entry: component,
            section: matchingSections,
          }
        );
      }
      const entryRelationshipsAtSameLevel =
        getEntryRelationshipsOfSameDepth(component);
      for (const entryRelationship of [...entryRelationshipsAtSameLevel]) {
        const { codeId: subCodeId, codeDisplayName: subCodeDisplayName } =
          getCodeIdSystemAndDisplayName(entryRelationship);
        const uSubCodeId = (subCodeId || subCodeDisplayName || '')?.trim();
        if (uCodeId && uSubCodeId) {
          if (!extractedSocialHistory[uCodeId]) {
            extractedSocialHistory[uCodeId] =
              extractCCDASocialHistoryItemFromEntry({
                codeDisplayName,
                entry: component,
                section: matchingSections,
              });
          }
          if (
            extractedSocialHistory[uCodeId]?.entityRelationships === undefined
          ) {
            extractedSocialHistory[uCodeId].entityRelationships = {};
          }
          extractedSocialHistory[uCodeId].entityRelationships![uSubCodeId] =
            extractCCDASocialHistoryItemFromEntry({
              entry: entryRelationship,
              section: matchingSections,
            });
          const subEntryRelationshipsAtSameLevel =
            getEntryRelationshipsOfSameDepth(entryRelationship);
          for (const subEntryRelationship of [
            ...subEntryRelationshipsAtSameLevel,
          ]) {
            const { codeId: subSubCodeId, codeDisplayName: subSubDisplayName } =
              getCodeIdSystemAndDisplayName(subEntryRelationship);
            const uSubSubId = (subSubCodeId || subSubDisplayName || '')?.trim();
            if (uCodeId && uSubCodeId && uSubSubId) {
              if (
                extractedSocialHistory?.[uCodeId]?.entityRelationships?.[
                  uSubCodeId
                ]?.entityRelationships === undefined
              ) {
                extractedSocialHistory[uCodeId].entityRelationships![
                  uSubCodeId
                ].entityRelationships = {};
              }
              extractedSocialHistory[uCodeId].entityRelationships![
                uSubCodeId
              ].entityRelationships![uSubSubId] =
                extractCCDASocialHistoryItemFromEntry({
                  entry: subEntryRelationship,
                  section: matchingSections,
                });
            }
          }
        }
      }
    }
  }
  return extractedSocialHistory;
}

function getCodeIdSystemAndDisplayName(component: Element) {
  let codeId = component?.getElementsByTagName('code')[0].getAttribute('code');
  let codeSystem = component
    ?.getElementsByTagName('code')[0]
    .getAttribute('codeSystem');
  let codeDisplayName: string | null =
    component?.getElementsByTagName('code')[0].getAttribute('displayName') ||
    component
      ?.getElementsByTagName('code')[0]
      ?.getElementsByTagName('originalText')?.[0]
      ?.innerHTML?.trim();
  if (codeSystem === SNOMED_CT_CODE_SYSTEM) {
    const translations = component
      ?.getElementsByTagName('code')[0]
      ?.getElementsByTagName('translation');
    const loincTranslation = [...translations].find(
      (t) => t?.getAttribute('codeSystem') === LOINC_CODE_SYSTEM
    );
    if (loincTranslation) {
      codeId = loincTranslation?.getAttribute('code');
      codeDisplayName = loincTranslation?.getAttribute('displayName');
      codeSystem = loincTranslation?.getAttribute('codeSystem');
    }
  }
  return { codeId, codeSystem, codeDisplayName };
}

function getEntryRelationshipsOfSameDepth(entry: Element) {
  const entryRelationships = entry?.getElementsByTagName('entryRelationship');
  // for each entryRelationship, get list of all parents
  // we will use this to determine which entryRelationships are at the same level in the tree
  const entryRelationshipsParentLength = [...entryRelationships].map((er) => {
    const els = [];
    while (er) {
      els.unshift(er);
      // @ts-ignore
      er = er.parentNode;
    }
    return els.length;
  });
  // get min length of all parents, and filter entryRelationships to only those with that length
  const minParentLength = Math.min(...entryRelationshipsParentLength);
  const entryRelationshipsAtSameLevel = [...entryRelationships].filter(
    (_, i) => entryRelationshipsParentLength[i] === minParentLength
  );
  return entryRelationshipsAtSameLevel;
}

function getValue(entry: Element, section: Element) {
  // Walk through each child of entry. if there is a entryRelationship, set value to ""
  // If there is a value element or interpretationCode, return value
  let children = [...entry.children];
  const childIsObservation = children.some(
    (child) => child.tagName === 'observation'
  );
  // replace children with observation children if child is observation
  if (childIsObservation) {
    children = [...entry.getElementsByTagName('observation')[0].children];
  }
  const hasEntryRelationship = children.some(
    (child) => child.tagName === 'entryRelationship'
  );
  const hasValueOrInterpretationCode = children.some(
    (child) =>
      child.tagName === 'value' || child.tagName === 'interpretationCode'
  );
  let valueIfEntryrelationshipCheck = '';
  if (
    (hasValueOrInterpretationCode && !hasEntryRelationship) ||
    (hasValueOrInterpretationCode && hasEntryRelationship)
  ) {
    valueIfEntryrelationshipCheck = (
      entry?.getElementsByTagName('value')?.[0]?.getAttribute('value') ||
      entry?.getElementsByTagName('value')?.[0]?.getAttribute('displayName') ||
      entry?.getElementsByTagName('value')?.[0]?.textContent?.trim() ||
      entry
        ?.getElementsByTagName('interpretationCode')?.[0]
        ?.getElementsByTagName('originalText')?.[0]?.innerHTML ||
      section
        ?.getElementsByTagName('text')?.[0]
        ?.querySelector(
          `[*|ID='${entry
            ?.getElementsByTagName('value')?.[0]
            ?.getElementsByTagName('reference')?.[0]
            ?.getAttribute('value')
            ?.replace('#', '')}']`
        )?.textContent ||
      ''
    ).trim();
  }

  return valueIfEntryrelationshipCheck;
}

function extractCCDASocialHistoryItemFromEntry({
  codeDisplayName,
  entry,
  section,
}: {
  codeDisplayName?: string | null;
  entry: Element;
  section: Element;
}) {
  return {
    title:
      codeDisplayName ||
      entry?.getElementsByTagName('code')?.[0]?.getAttribute('displayName') ||
      entry?.getElementsByTagName('text')?.[0]?.innerHTML?.trim() ||
      entry?.getElementsByTagName('originalText')?.[0]?.innerHTML ||
      '',
    value: getValue(entry, section),
    datetime:
      entry
        ?.getElementsByTagName('effectiveTime')?.[0]
        ?.getAttribute('value') || '',
    datetimeLow:
      entry
        ?.getElementsByTagName('effectiveTime')?.[0]
        ?.getElementsByTagName('low')?.[0]
        ?.getAttribute('value') || '',
    datetimeHigh:
      entry
        ?.getElementsByTagName('effectiveTime')?.[0]
        ?.getElementsByTagName('high')?.[0]
        ?.getAttribute('value') || '',
    statusCode: entry
      ?.getElementsByTagName('statusCode')?.[0]
      ?.getAttribute('code'),
  };
}

export function DisplayCCDASocialHistorySection({
  data,
  uniqueDates,
}: {
  data: Record<string, CCDASocialHistoryItem>;
  uniqueDates: Set<string | null>;
}) {
  return (
    <SocialHistoryComponentSection data={data} uniqueDates={uniqueDates} />
  );
}

export interface CCDASocialHistoryItem {
  title: string;
  value: string | null;
  datetime: string | null;
  datetimeLow: string | null;
  datetimeHigh: string | null;
  statusCode: string | null;
  entityRelationships?: Record<string, CCDASocialHistoryItem>;
}
