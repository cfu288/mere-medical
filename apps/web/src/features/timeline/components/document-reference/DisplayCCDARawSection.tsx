import { Disclosure } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import DOMPurify from 'dompurify';
import { useMemo } from 'react';
import parse from 'html-react-parser';

export function DisplayCCDARawSection({
  title,
  content,
  isMatched = false,
  defaultOpen = false,
}: {
  title: string;
  content: string;
  isMatched?: boolean;
  defaultOpen?: boolean;
}) {
  const sanitizedData = useMemo(() => {
    return parse(DOMPurify.sanitize(content));
  }, [content]);

  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <>
          <Disclosure.Button
            className={`mb-2 w-full rounded-md p-2 font-bold transition-colors ${
              isMatched
                ? 'bg-purple-100 hover:bg-purple-200 ring-2 ring-purple-400'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                {title}
                {isMatched && (
                  <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">
                    Match
                  </span>
                )}
              </span>
              <ChevronRightIcon
                className={`h-8 w-8 rounded duration-150 active:scale-95 ${
                  isMatched ? 'text-purple-600' : ''
                } ${open ? 'rotate-90 transform' : ''}`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="m-4 text-sm text-gray-800 ">
            <p className="p-2 sm:prose prose-sm overflow-x-auto [&_table]:table-auto [&_tr]:border-b [&_caption]:text-center">
              {sanitizedData}
            </p>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
