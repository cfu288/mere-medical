import { Dialog } from '@headlessui/react';
import { ChevronLeftIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { ReactNode } from 'react';

export function ModalHeader({
  title,
  subtitle,
  setClose,
  back,
}: {
  title: string;
  subtitle?: string | ReactNode;
  setClose?: (x: boolean) => void;
  back?: () => void;
}) {
  return (
    <Dialog.Title className="flex w-full flex-col p-4 pb-2">
      {/* <div className="flex w-full flex-col p-4 px-0 pb-2"> */}
      <div className="flex justify-between">
        {back ? (
          <button
            type="button"
            className="rounded bg-white text-gray-700 duration-75 hover:text-gray-700 focus:text-gray-700 focus:outline-none focus:ring-0 active:scale-90 active:bg-slate-50"
            onClick={back}
          >
            <span className="sr-only">Back</span>
            <ChevronLeftIcon className="h-8 w-8" aria-hidden="true" />
          </button>
        ) : null}
        <p className="w-full text-xl font-bold">{title}</p>
        {setClose ? (
          <button
            type="button"
            className="ml-4 rounded bg-white text-gray-700 duration-75 hover:text-gray-700 focus:text-gray-700 focus:outline-none focus:ring-0 active:scale-90 active:bg-slate-50"
            onClick={() => setClose(false)}
          >
            <span className="sr-only">Close</span>
            <XMarkIcon className="h-8 w-8" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div>{subtitle}</div>
      {/* </div> */}
    </Dialog.Title>
  );
}
