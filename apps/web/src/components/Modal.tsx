import { PropsWithChildren } from 'react';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';

export function Modal({
  open,
  setOpen,
  afterLeave,
  children,
  id,
  overflowHidden = false,
}: PropsWithChildren<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  afterLeave?: () => void;
  overflowHidden?: boolean;
  id?: string;
}>) {
  if (open) {
    return (
      <Dialog as="div" className="relative z-30" onClose={setOpen}>
        {/* Background opacity */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 transition-opacity" />
        {/* Modal */}
        <div className="fixed inset-0 z-10 flex flex-col overflow-y-auto pt-12 sm:p-12">
          <Dialog.Panel
            className={`mx-auto w-screen transform rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition-all sm:w-auto sm:min-w-[50%] sm:max-w-3xl ${
              overflowHidden ? 'overflow-hidden' : ''
            }`}
          >
            {children}
          </Dialog.Panel>
        </div>
      </Dialog>
    );
  }

  return null;
}
