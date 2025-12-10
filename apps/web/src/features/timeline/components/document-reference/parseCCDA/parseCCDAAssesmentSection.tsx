import { Disclosure } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { title } from 'process';
import { LOINC_CODE_SYSTEM } from '../ShowDocumentReferenceAttachmentExpandable';
import { getMatchingSections, parseDateString } from './parseCCDA';

export function parseCCDAAssesmentSection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string,
): CCDAAssesmentData | null {
  const matchingSections = getMatchingSections(sections, id);
  if (!matchingSections) {
    return null;
  }

  const title =
    matchingSections?.[0]?.getElementsByTagName('title')?.[0]?.innerHTML;
  const textComponent = [...(matchingSections as unknown as HTMLElement[])]
    ?.map((e) => [
      ...(e.getElementsByTagName(
        'text',
      ) as unknown as HTMLCollectionOf<HTMLElement>),
    ])
    ?.flat()?.[0];
  if (!textComponent) {
    return null;
  }

  return {
    title,
    value: textComponent.innerHTML,
  };
}

export interface CCDAAssesmentData {
  title: string;
  value: string | null;
}

export function DisplayCCDAAssesmentSection({
  data,
}: {
  data: CCDAAssesmentData;
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
          <Disclosure.Panel className="m-1 text-sm text-gray-800">
            <div
              className="sm:prose prose-sm max-w-none [&_table]:table-auto [&_tr]:border-b [&_caption]:text-center"
              dangerouslySetInnerHTML={{ __html: data.value || '' }}
            />
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
