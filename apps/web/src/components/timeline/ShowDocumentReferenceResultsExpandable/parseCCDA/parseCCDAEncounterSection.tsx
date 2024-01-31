/* eslint-disable react/jsx-no-useless-fragment */
import { Disclosure } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { title } from 'process';
import {
  LOINC_CODE_SYSTEM,
  SNOMED_CT_CODE_SYSTEM,
} from '../ShowDocumentReferenceAttachmentExpandable';
import { getMatchingSections, parseDateString } from './parseCCDA';

function getCodeIdSystemAndDisplayName(component: Element) {
  let codeId =
    component?.getElementsByTagName('code')?.[0]?.getAttribute('code') || '';
  let codeSystem =
    component?.getElementsByTagName('code')[0].getAttribute('codeSystem') || '';
  let codeDisplayName: string =
    component?.getElementsByTagName('code')[0].getAttribute('displayName') ||
    component
      ?.getElementsByTagName('code')[0]
      ?.getElementsByTagName('originalText')?.[0]
      ?.innerHTML?.trim() ||
    '';
  if (codeSystem === SNOMED_CT_CODE_SYSTEM) {
    const translations = component
      ?.getElementsByTagName('code')[0]
      ?.getElementsByTagName('translation');
    const loincTranslation = [...translations].find(
      (t) => t?.getAttribute('codeSystem') === LOINC_CODE_SYSTEM,
    );
    if (loincTranslation) {
      codeId = loincTranslation?.getAttribute('code') || '';
      codeDisplayName = loincTranslation?.getAttribute('displayName') || '';
      codeSystem = loincTranslation?.getAttribute('codeSystem') || '';
    }
  }
  return { codeId, codeSystem, codeDisplayName };
}

function getPerformersFromEncounter(
  encounter: Element,
): Partial<CCDAPerformer>[] {
  const performers: Partial<CCDAPerformer>[] = [];

  const performerElements = getChildOfElementByTagName(encounter, 'performer');
  for (const performer of performerElements) {
    const assignedEntityElement =
      performer.getElementsByTagName('assignedEntity')[0];
    if (!assignedEntityElement) continue;

    const codeElement = assignedEntityElement.getElementsByTagName('code')[0];
    const assignedPersonElement =
      assignedEntityElement.getElementsByTagName('assignedPerson')[0];
    const representedOrganizationElement =
      assignedEntityElement.getElementsByTagName('representedOrganization')[0];

    const code = codeElement ? codeElement.getAttribute('code') : undefined;
    const codeSystem = codeElement
      ? codeElement.getAttribute('codeSystem')
      : undefined;
    const displayName = codeElement
      ? codeElement.getAttribute('displayName')
      : undefined;

    const given =
      assignedPersonElement?.getElementsByTagName('given')[0]?.textContent;
    const family =
      assignedPersonElement?.getElementsByTagName('family')[0]?.textContent;
    const prefix =
      assignedPersonElement?.getElementsByTagName('prefix')[0]?.textContent;
    const suffix =
      assignedPersonElement?.getElementsByTagName('suffix')[0]?.textContent;

    const telecomElements =
      assignedEntityElement.getElementsByTagName('telecom');
    const telecom =
      Array.from(telecomElements).map((telecomElement) => ({
        value: telecomElement.getAttribute('value') || undefined || '',
      })) || [];

    const organizationName =
      representedOrganizationElement?.getElementsByTagName('name')[0]
        ?.textContent;

    performers.push({
      assignedEntity: {
        code: {
          code: code || '',
          codeSystem: codeSystem || '',
          displayName: displayName || '',
        },
        assignedPerson: {
          name: {
            given: given || '',
            family: family || '',
            prefix: prefix || '',
            suffix: suffix || '',
          },
        },
        telecom,
        representedOrganization: {
          name: organizationName || '',
        },
      },
    });
  }

  return performers;
}

function getParticipantsFromEncounter(
  encounter: Element,
): Partial<CCDAParticipant>[] {
  if (!encounter) {
    return [];
  }

  const participantElements = getChildOfElementByTagName(
    encounter,
    'participant',
  );

  const participants = Array.from(participantElements)
    .map((participantElement) => {
      const participantRoleElement =
        participantElement.getElementsByTagName('participantRole')[0];
      if (!participantRoleElement) {
        return null;
      }

      const { codeId, codeDisplayName, codeSystem } =
        getCodeIdSystemAndDisplayName(participantRoleElement);
      const addrElements = participantRoleElement.getElementsByTagName('addr');
      const addr = Array.from(addrElements).map((addrElement) => ({
        streetAddressLine:
          addrElement.getElementsByTagName('streetAddressLine')[0]
            ?.textContent || '',
        city: addrElement.getElementsByTagName('city')[0]?.textContent || '',
        state: addrElement.getElementsByTagName('state')[0]?.textContent || '',
        postalCode:
          addrElement.getElementsByTagName('postalCode')[0]?.textContent || '',
        country:
          addrElement.getElementsByTagName('country')[0]?.textContent || '',
      }));

      const telecomElements =
        participantRoleElement.getElementsByTagName('telecom');
      const telecom = Array.from(telecomElements).map((telecomElement) => ({
        value: telecomElement.getAttribute('value') || '',
      }));

      const playingEntityElement =
        participantRoleElement.getElementsByTagName('playingEntity')[0];
      const name =
        playingEntityElement?.getElementsByTagName('name')[0]?.textContent ||
        '';
      const desc =
        playingEntityElement?.getElementsByTagName('desc')[0]?.textContent ||
        '';

      return {
        participantRole: {
          code: {
            code: codeId,
            displayName: codeDisplayName,
            codeSystem,
          },
          addr,
          telecom,
          playingEntity: {
            name,
            desc,
          },
        },
      };
    })
    .filter(
      (participant) => participant !== null,
    ) as Partial<CCDAParticipant>[];

  return participants;
}

function getAuthorsFromEncounter(encounter: Element): Partial<CCDAAuthor>[] {
  if (!encounter) {
    return [];
  }

  const authorElements = getChildOfElementByTagName(encounter, 'author');

  const authors = Array.from(authorElements)
    .map((authorElement) => {
      const assignedAuthorElement =
        authorElement.getElementsByTagName('assignedAuthor')[0];
      if (!assignedAuthorElement) {
        return null;
      }
      const addrElements = assignedAuthorElement.getElementsByTagName('addr');
      const addr = Array.from(addrElements).map((addrElement) => ({
        streetAddressLine:
          addrElement.getElementsByTagName('streetAddressLine')[0]
            ?.textContent || '',
        city: addrElement.getElementsByTagName('city')[0]?.textContent || '',
        state: addrElement.getElementsByTagName('state')[0]?.textContent || '',
        postalCode:
          addrElement.getElementsByTagName('postalCode')[0]?.textContent || '',
        country:
          addrElement.getElementsByTagName('country')[0]?.textContent || '',
      }));
      const telecomElements =
        assignedAuthorElement.getElementsByTagName('telecom');
      const telecom = Array.from(telecomElements).map((telecomElement) => ({
        value: telecomElement.getAttribute('value') || '',
      }));
      const representedOrganizationElement =
        assignedAuthorElement.getElementsByTagName(
          'representedOrganization',
        )[0];
      const organizationName =
        representedOrganizationElement?.getElementsByTagName('name')[0]
          ?.textContent || '';
      const organizationAddrElements =
        representedOrganizationElement?.getElementsByTagName('addr') || [];
      const organizationAddr = Array.from(organizationAddrElements).map(
        (addrElement) => ({
          streetAddressLine:
            addrElement.getElementsByTagName('streetAddressLine')[0]
              ?.textContent || '',
          city: addrElement.getElementsByTagName('city')[0]?.textContent || '',
          state:
            addrElement.getElementsByTagName('state')[0]?.textContent || '',
          postalCode:
            addrElement.getElementsByTagName('postalCode')[0]?.textContent ||
            '',
          country:
            addrElement.getElementsByTagName('country')[0]?.textContent || '',
        }),
      );
      return {
        assignedAuthor: {
          addr,
          telecom,
          representedOrganization: {
            name: organizationName,
            addr: organizationAddr,
          },
        },
      };
    })
    .filter((author) => author !== null) as Partial<CCDAAuthor>[];
  return authors;
}

function getValue(entry: Element, section: Element) {
  // Walk through each child of entry. if there is a entryRelationship, set value to ""
  // If there is a value element or interpretationCode, return value
  let children = [...entry.children];
  const childIsObservation = children.some(
    (child) => child.tagName === 'observation',
  );
  // replace children with observation children if child is observation
  if (childIsObservation) {
    children = [...entry.getElementsByTagName('observation')[0].children];
  }
  const hasValueOrInterpretationCodeAsChild = children.some(
    (child) =>
      child.tagName === 'value' || child.tagName === 'interpretationCode',
  );
  let valueIfEntryRelationshipCheck = '';
  if (hasValueOrInterpretationCodeAsChild) {
    valueIfEntryRelationshipCheck = (
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
            ?.replace('#', '')}']`,
        )?.textContent ||
      ''
    ).trim();
  }

  return valueIfEntryRelationshipCheck;
}

function getEntryRelationshipsFromEncounter(
  encounter: Element,
  section: Element,
): Partial<{
  code?: string;
  codeSystem?: string;
  displayName?: string;
  value?: string;
  interpretationCode?: string;
  interpretationCodeSystem?: string;
  interpretationDisplayName?: string;
  originalText?: string;
}>[] {
  if (!encounter) {
    return [];
  }

  const entryRelationshipElements = getChildOfElementByTagName(
    encounter,
    'entryRelationship',
  );

  const entryRelationships = Array.from(entryRelationshipElements)
    .map((entryRelationshipElement) => {
      const observationElement =
        entryRelationshipElement.getElementsByTagName('observation')[0];
      if (!observationElement) {
        return undefined;
      }
      const {
        codeId: code,
        codeDisplayName: displayName,
        codeSystem,
      } = getCodeIdSystemAndDisplayName(observationElement);
      const value = getValue(observationElement, section);
      const interpretationCodeElement =
        observationElement.getElementsByTagName('interpretationCode')[0];
      const interpretationCode = interpretationCodeElement
        ? interpretationCodeElement.getAttribute('code')
        : '';
      const interpretationCodeSystem = interpretationCodeElement
        ? interpretationCodeElement.getAttribute('codeSystem')
        : '';
      const interpretationDisplayName = interpretationCodeElement
        ? interpretationCodeElement.getAttribute('displayName')
        : '';
      const originalTextElement =
        observationElement.getElementsByTagName('originalText')[0];
      const originalText = originalTextElement
        ? originalTextElement.innerHTML
        : '';
      const entryRelationship = {
        code,
        codeSystem,
        displayName,
        value,
        interpretationCode,
        interpretationCodeSystem,
        interpretationDisplayName,
        originalText,
      };
      return entryRelationship;
    })
    .filter((i) => i !== undefined);

  return entryRelationships as Partial<{
    code?: string;
    codeSystem?: string;
    displayName?: string;
    value?: string;
    interpretationCode?: string;
    interpretationCodeSystem?: string;
    interpretationDisplayName?: string;
    originalText?: string;
  }>[];
}

function getChildOfElementByTagName(element: Element, tagName: string) {
  const children = [...element.children];
  const childMatchesTag = children.filter((child) => child.tagName === tagName);
  return childMatchesTag;
}

export function parseCCDAEncounterSection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string,
): Partial<CCDAEncounterData> | null {
  const matchingSections = getMatchingSections(sections, id);
  if (!matchingSections || matchingSections.length === 0) {
    return null;
  }

  const section = matchingSections[0];
  const titleElement = section?.getElementsByTagName('title')?.[0];
  const title = (titleElement ? titleElement.textContent : '') || '';
  const textComponent = [...section.getElementsByTagName('text')].shift();
  const description = (textComponent ? textComponent.innerHTML : '') || '';

  const entry = section.getElementsByTagName('entry')?.[0];
  const encounterFromEntry = entry?.getElementsByTagName('encounter')?.[0];
  const codeFromEncounter = getCodeIdSystemAndDisplayName(encounterFromEntry);

  const performersFromEncounter =
    getPerformersFromEncounter(encounterFromEntry);
  const authorsFromEncounter = getAuthorsFromEncounter(encounterFromEntry);
  const participantsFromEncounter =
    getParticipantsFromEncounter(encounterFromEntry);
  // Parse date, type, department, care team, effective time, location, and diagnosis from the encounter section
  const effectiveTimeElement =
    section.getElementsByTagName('effectiveTime')?.[0];
  const effectiveTime =
    (effectiveTimeElement ? effectiveTimeElement.getAttribute('value') : '') ||
    '';
  const effectiveTimeLow =
    (effectiveTimeElement
      ? effectiveTimeElement
          .getElementsByTagName('low')?.[0]
          ?.getAttribute('value')
      : '') || '';
  const effectiveTimeHigh =
    (effectiveTimeElement
      ? effectiveTimeElement
          .getElementsByTagName('high')?.[0]
          ?.getAttribute('value')
      : '') || '';

  const code = getCodeIdSystemAndDisplayName(section);

  const departmentElement =
    section
      .getElementsByTagName('participant')?.[0]
      ?.getElementsByTagName('code')?.[0] || '';
  const department =
    (departmentElement
      ? departmentElement.getElementsByTagName('originalText')?.[0]?.textContent
      : '') || '';

  const diagnosis = getEntryRelationshipsFromEncounter(
    encounterFromEntry,
    section,
  );

  const encounterData: Partial<CCDAEncounterData> = {
    title,
    date: effectiveTime, // Assuming the effectiveTime is the date for the encounter
    code,
    encounterCode: codeFromEncounter,
    department,
    // careTeam, // Parsed care team data
    performer: performersFromEncounter,
    author: authorsFromEncounter,
    participant: participantsFromEncounter,
    description,
    effectiveTime,
    effectiveTimeLow,
    effectiveTimeHigh,
    diagnosises: diagnosis,
  };
  return encounterData;
}

export function DisplayCCDAEncounterSection({
  data,
}: {
  data: Partial<CCDAEncounterData>;
}) {
  return (
    <Disclosure defaultOpen>
      {({ open }) => (
        <>
          <Disclosure.Button className="mb-1 w-full rounded-md bg-gray-50 p-1 font-bold">
            <div className="flex w-full items-center justify-between text-left">
              {data.title}
              <ChevronRightIcon
                className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                  open ? 'rotate-90 transform' : ''
                }`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="m-1 text-sm text-gray-900">
            <div className="bg-gray-50 border-gray-200 overflow-hidden rounded-lg border">
              {data.department && (
                <div className="border-t border-gray-200">
                  <dl>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Department:
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {data.department}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              {data.effectiveTime && (
                <div className="border-t border-gray-200">
                  <dl>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Effective Time:
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {parseDateString(data.effectiveTime)}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              {(data.effectiveTimeLow || data.effectiveTimeHigh) && (
                <div className="border-t border-gray-200">
                  <dl>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Effective Time Range:
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <dl className="flex">
                          {data.effectiveTimeLow && (
                            <>
                              <dt className="font-medium mr-1">Start:</dt>
                              <dd>{parseDateString(data.effectiveTimeLow)}</dd>
                            </>
                          )}
                        </dl>
                        <dl className="flex">
                          {data.effectiveTimeHigh && (
                            <>
                              <dt className="font-medium mr-1">End:</dt>
                              <dd>{parseDateString(data.effectiveTimeHigh)}</dd>
                            </>
                          )}
                        </dl>
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              {data.performer &&
                data.performer.some(
                  (i) =>
                    i.assignedEntity?.assignedPerson.name.family ||
                    i.assignedEntity?.assignedPerson.name.given,
                ) && (
                  <div className="border-t border-gray-200">
                    <dl>
                      <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">
                          Performers:
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          <ul className="border border-gray-200 rounded-md divide-y divide-gray-200">
                            {data.performer.map((performer, index) => (
                              <li
                                key={index}
                                className="pl-3 pr-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between text-sm"
                              >
                                <span className="items-center">
                                  {performer.assignedEntity?.assignedPerson
                                    ?.name.prefix + ' '}
                                  {performer.assignedEntity?.assignedPerson
                                    ?.name?.given + ' '}
                                  {performer.assignedEntity?.assignedPerson
                                    ?.name?.family + ' '}
                                  {
                                    performer.assignedEntity?.assignedPerson
                                      ?.name.suffix
                                  }
                                </span>
                                <p className="flex flex-col">
                                  {performer.assignedEntity?.telecom &&
                                    performer.assignedEntity.telecom.length >
                                      0 && (
                                      <>
                                        {performer.assignedEntity.telecom.map(
                                          (contact, contactIndex) => (
                                            <span className="sm:ml-4 flex-shrink-0">
                                              <a
                                                key={contactIndex}
                                                href={`${contact.value}`}
                                                className="text-indigo-600 hover:text-indigo-900"
                                              >
                                                {contact.value}
                                              </a>
                                            </span>
                                          ),
                                        )}
                                      </>
                                    )}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              {data.author && data.author.length > 0 && (
                <div className="border-t border-gray-200">
                  <dl>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Authors:
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <ul className="border border-gray-200 rounded-md divide-y divide-gray-200">
                          {data.author.map((author, index) => (
                            <li
                              key={index}
                              className="pl-3 pr-4 py-3 flex flex-col justify-between text-sm"
                            >
                              <p className="flex flex-col font-semibold">
                                {
                                  author.assignedAuthor?.representedOrganization
                                    ?.name
                                }
                              </p>
                              <p className="flex flex-col">
                                {author.assignedAuthor?.representedOrganization?.addr?.map(
                                  (addr) => (
                                    <>
                                      {addr.streetAddressLine && (
                                        <span className="flex-shrink-0">
                                          {addr.streetAddressLine}
                                        </span>
                                      )}
                                      {addr.city &&
                                        addr.state &&
                                        addr.postalCode && (
                                          <span className="flex-shrink-0">
                                            {addr.city}, {addr.state}{' '}
                                            {addr.postalCode}
                                          </span>
                                        )}
                                      {addr.country && (
                                        <span className="flex-shrink-0">
                                          {addr.country}
                                        </span>
                                      )}
                                    </>
                                  ),
                                )}
                              </p>
                              {author.assignedAuthor?.telecom &&
                                author.assignedAuthor.telecom.length > 0 && (
                                  <span className="flex-shrink-0">
                                    {author.assignedAuthor.telecom.map(
                                      (contact, contactIndex) => (
                                        <a
                                          key={contactIndex}
                                          href={`${contact.value}`}
                                          className="text-indigo-600 hover:text-indigo-900"
                                        >
                                          {contact.value}
                                        </a>
                                      ),
                                    )}
                                  </span>
                                )}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              {data.participant && data.participant.length > 0 && (
                <div className="border-t border-gray-200">
                  <dl>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Participants:
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <ul className="border border-gray-200 rounded-md divide-y divide-gray-200">
                          {data.participant.map((participant, index) => (
                            <li
                              key={index}
                              className="pl-3 pr-4 py-3 flex flex-col justify-between text-sm"
                            >
                              <p className="flex flex-col font-semibold">
                                {
                                  participant.participantRole?.playingEntity
                                    ?.name
                                }
                              </p>
                              <p className="flex flex-col">
                                {participant.participantRole?.addr?.map(
                                  (addr, addrIndex) => (
                                    <>
                                      {addr.streetAddressLine && (
                                        <span className="flex-shrink-0">
                                          {addr.streetAddressLine}
                                        </span>
                                      )}
                                      {addr.city &&
                                        addr.state &&
                                        addr.postalCode && (
                                          <span className="flex-shrink-0">
                                            {addr.city}, {addr.state}{' '}
                                            {addr.postalCode}
                                          </span>
                                        )}
                                      {addr.country && (
                                        <span className="flex-shrink-0">
                                          {addr.country}
                                        </span>
                                      )}
                                    </>
                                  ),
                                )}
                              </p>
                              {participant.participantRole?.telecom &&
                                participant.participantRole.telecom.length >
                                  0 && (
                                  <span className="ml-4 flex-shrink-0">
                                    {participant.participantRole.telecom.map(
                                      (contact, contactIndex) => (
                                        <a
                                          key={contactIndex}
                                          href={`${contact.value}`}
                                          className="text-indigo-600 hover:text-indigo-900"
                                        >
                                          {contact.value}
                                        </a>
                                      ),
                                    )}
                                  </span>
                                )}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              {data.diagnosises && data.diagnosises.length > 0 && (
                <div className="border-t border-gray-200">
                  <dl>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">
                        Diagnoses:
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <ul className="border border-gray-200 rounded-md divide-y divide-gray-200">
                          {data.diagnosises.map((diag, index) => (
                            <>
                              {diag?.originalText || diag?.displayName ? (
                                <li
                                  key={index}
                                  className="pl-3 pr-4 py-3 flex items-center justify-between text-sm"
                                >
                                  <p className="w-0 flex-1 flex items-center">
                                    {diag.originalText ||
                                      diag?.displayName ||
                                      ''}
                                  </p>
                                </li>
                              ) : (
                                <>{JSON.stringify(data.diagnosises)}</>
                              )}
                            </>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}

export interface CCDAAuthor {
  assignedAuthor: {
    addr: Array<{
      streetAddressLine?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    }>;
    telecom: Array<{
      value?: string;
    }>;
    representedOrganization: {
      name?: string;
      addr: Array<{
        streetAddressLine?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      }>;
    };
  };
}

export interface CCDAPerformer {
  assignedEntity: {
    code: {
      code: string;
      codeSystem: string;
      displayName: string;
    };
    assignedPerson: {
      name: {
        given: string;
        family: string;
        prefix: string;
        suffix: string;
      };
    };
    telecom: {
      value: string;
    }[];
    representedOrganization: {
      name: string;
    };
  };
}

export interface CCDAParticipant {
  participantRole?: {
    code?: {
      code?: string;
      codeSystem?: string;
      displayName?: string;
    };
    addr?: {
      streetAddressLine?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    }[];
    telecom?: {
      value?: string;
    }[];
    playingEntity?: {
      name?: string;
      desc?: string;
    };
  };
}

export interface CCDAEncounterData {
  title?: string;
  date?: string;
  code?: {
    codeId?: string;
    codeSystem?: string;
    codeDisplayName?: string;
  };
  encounterCode?: {
    codeId?: string;
    codeSystem?: string;
    codeDisplayName?: string;
  };
  performer?: Partial<CCDAPerformer>[];
  participant?: Partial<CCDAParticipant>[];
  author?: Partial<CCDAAuthor>[];
  department?: string;
  careTeam?: {
    name: string;
    role: string;
  }[];
  description?: string;
  effectiveTime?: string;
  effectiveTimeLow?: string;
  effectiveTimeHigh?: string;
  diagnosises?: {
    code?: string;
    codeSystem?: string;
    displayName?: string;
    value?: string;
    interpretationCode?: string;
    interpretationCodeSystem?: string;
    interpretationDisplayName?: string;
    originalText?: string;
  }[];
}
