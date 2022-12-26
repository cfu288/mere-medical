import { PropsWithChildren } from 'react';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export function Modal({
  open,
  setOpen,
  afterLeave,
  children,
  overflowHidden = false,
}: PropsWithChildren<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  afterLeave?: () => void;
  overflowHidden?: boolean;
}>) {
  return (
    <Transition.Root show={open} as={Fragment} afterLeave={afterLeave} appear>
      <Dialog as="div" className="relative z-30" onClose={setOpen}>
        {/* Background opacity */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-25 transition-opacity" />
        </Transition.Child>
        {/* Modal */}
        <div className="fixed inset-0 z-10 flex flex-col overflow-y-auto pt-12 sm:p-12">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95 translate-y-1/2"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-200 translate-y-1/2"
            leaveFrom="opacity-100 scale-100 translate-y-0"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel
              className={`mx-auto w-screen transform rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition-all sm:w-auto sm:min-w-[50%] sm:max-w-3xl ${
                overflowHidden ? 'overflow-hidden' : ''
              }`}
            >
              {children}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
