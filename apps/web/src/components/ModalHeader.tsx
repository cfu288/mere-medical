import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { ReactNode } from 'react';

export function ModalHeader({
  title,
  subtitle,
  setClose,
}: {
  title: string;
  subtitle?: string | ReactNode;
  setClose: (x: boolean) => void;
}) {
  return (
    <Dialog.Title>
      <div className="flex w-full flex-col p-4 pb-2">
        <div className="flex justify-between">
          <p className="text-xl font-bold">{title}</p>
          <button
            type="button"
            className="rounded-3xl bg-white text-gray-500 hover:text-gray-700 focus:text-gray-700 focus:outline-none focus:ring-0 "
            onClick={() => setClose(false)}
          >
            <span className="sr-only">Close</span>
            <XMarkIcon className="ml-4 h-8 w-8" aria-hidden="true" />
          </button>
        </div>
        <p>{subtitle}</p>
      </div>
    </Dialog.Title>
  );
}
