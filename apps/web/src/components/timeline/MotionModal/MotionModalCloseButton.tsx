import { PropsWithChildren } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export function MotionModalCloseButton({
  id,
  setExpanded,
}: PropsWithChildren<{ id?: string; setExpanded: (_: boolean) => void }>) {
  return (
    <motion.button
      type="button"
      layoutId={id ? `card-toggle-button-${id}` : undefined}
      className="ml-4 rounded bg-white text-gray-500 duration-75 hover:text-gray-700 focus:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-90 active:bg-slate-50"
      onClick={() => setExpanded(false)}
    >
      <motion.span className="sr-only">Close</motion.span>
      <XMarkIcon className="h-8 w-8" aria-hidden="true" />
    </motion.button>
  );
}
