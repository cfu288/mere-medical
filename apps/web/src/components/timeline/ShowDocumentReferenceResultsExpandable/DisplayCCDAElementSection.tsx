import { Disclosure } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';

export function DisplayCCDAElementSection({
  title,
  content,
}: {
  title: string;
  content: JSX.Element;
}) {
  return (
    <Disclosure>
      {({ open }) => (
        <>
          <Disclosure.Button className="mb-2 w-full rounded-md bg-gray-100 p-2 font-bold">
            <div className="flex w-full items-center justify-between">
              {title}
              <ChevronRightIcon
                className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                  open ? 'rotate-90 transform' : ''
                }`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="m-4 overflow-x-auto text-sm text-gray-800">
            {content}
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
