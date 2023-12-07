import { Disclosure } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { LOINC_CODE_SYSTEM } from '../ShowDocumentReferenceResultsExpandable';
import { getMatchingSections, parseDateString } from './parseCCDA';

export function parseCCDAHPISection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  const matchingSections = getMatchingSections(sections, id);
  if (!matchingSections) {
    return null;
  }

  const entry = [...matchingSections].map(
    (x) => x.getElementsByTagName('entry')?.[0]
  )?.[0];
  if (!entry) {
    return null;
  }

  let extractedNote: {
    codeId: string;
    codeSystem: string;
    codeDisplayName: string | null;
    title: string;
    text: string | null;
    datetime: string | null;
    author: string | null;
    address?: Partial<{
      streetAddressLine: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
    }>;
  };
  const codeId = entry?.getElementsByTagName('code')[0].getAttribute('code');
  const codeSystem = entry
    ?.getElementsByTagName('code')[0]
    .getAttribute('codeSystem');
  const codeDisplayName = entry
    ?.getElementsByTagName('code')[0]
    .getAttribute('displayName');
  if (codeSystem === LOINC_CODE_SYSTEM && codeId) {
    extractedNote = {
      codeId,
      codeSystem,
      codeDisplayName,
      title:
        matchingSections?.[0]?.getElementsByTagName('title')?.[0]?.innerHTML ||
        codeDisplayName ||
        '',
      text: matchingSections?.[0]?.getElementsByTagName('text')?.[0]?.innerHTML,
      datetime: entry
        ?.getElementsByTagName('effectiveTime')?.[0]
        ?.getAttribute('value'),
      author: parseAuthorFromEntry(entry),
      address: {
        streetAddressLine: entry
          ?.getElementsByTagName('addr')?.[0]
          ?.getElementsByTagName('streetAddressLine')?.[0]?.innerHTML,
        city: entry
          ?.getElementsByTagName('addr')?.[0]
          ?.getElementsByTagName('city')?.[0]?.innerHTML,
        state: entry
          ?.getElementsByTagName('addr')?.[0]
          ?.getElementsByTagName('state')?.[0]?.innerHTML,
        postalCode: entry
          ?.getElementsByTagName('addr')?.[0]
          ?.getElementsByTagName('postalCode')?.[0]?.innerHTML,
      },
    };

    return (
      <Disclosure defaultOpen>
        {({ open }) => (
          <>
            <Disclosure.Button className="mb-1 w-full rounded-md bg-gray-50 p-1 font-bold">
              <div className="flex w-full items-center justify-between text-left">
                {extractedNote?.title || ''}{' '}
                {extractedNote?.author ? `- ${extractedNote?.author}` : ''}
                <ChevronRightIcon
                  className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                    open ? 'rotate-90 transform' : ''
                  }`}
                />
              </div>
            </Disclosure.Button>
            <Disclosure.Panel className="m-1 text-sm text-gray-700">
              <p
                className="text-md whitespace-wrap max-h-screen overflow-y-scroll p-2 text-gray-900"
                dangerouslySetInnerHTML={{
                  __html: extractedNote?.text || 'No note',
                }}
              />
              {/* horizonal divider */}
              <hr className="my-4" />

              <p className="mt-2 mb-4 text-sm font-semibold italic text-gray-900">
                Note taken at {parseDateString(extractedNote?.datetime || '')}{' '}
                by {extractedNote?.author || ''}
              </p>
              <p className="mt-2 text-sm italic text-gray-900">
                {extractedNote?.address?.streetAddressLine || ''}
              </p>
              <p className="m mb-2 text-sm italic text-gray-900">
                {extractedNote?.address?.city || ''},{' '}
                {extractedNote?.address?.state || ''}{' '}
                {extractedNote?.address?.postalCode || ''}
              </p>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    );
  }
  return null;
}
function parseAuthorFromEntry(entry: Element): string | null {
  const firstName = entry
    ?.getElementsByTagName('assignedAuthor')?.[0]
    ?.getElementsByTagName('assignedPerson')?.[0]
    ?.getElementsByTagName('name')?.[0]
    ?.getElementsByTagName('given')?.[0].innerHTML;

  const lastName = entry
    ?.getElementsByTagName('assignedAuthor')?.[0]
    ?.getElementsByTagName('assignedPerson')?.[0]
    ?.getElementsByTagName('name')?.[0]
    ?.getElementsByTagName('family')?.[0].innerHTML;

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  return null;
}
