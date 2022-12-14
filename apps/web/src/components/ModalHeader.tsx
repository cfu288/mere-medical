import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/20/solid';

export function ModalHeader({
  title,
  setClose: setOpen,
}: {
  title: string;
  setClose: (x: boolean) => void;
}) {
  return (
    <Dialog.Title>
      <div className="flex justify-between">
        <p className="p-4 text-xl font-bold">{title}</p>
        <button
          type="button"
          className="rounded-3xl bg-white text-gray-500 hover:text-gray-700 focus:text-gray-700 focus:outline-none focus:ring-0 "
          onClick={() => setOpen(false)}
        >
          <span className="sr-only">Close</span>
          <XMarkIcon className="mr-4 h-8 w-8" aria-hidden="true" />
        </button>
      </div>
    </Dialog.Title>
  );
}
