import { motion } from 'framer-motion';
import { PropsWithChildren } from 'react';

export function TimelineCardTitle({
  id,
  children,
}: PropsWithChildren<{ id?: string }>) {
  return (
    <motion.p
      layoutId={`card-title-${id}`}
      className="break-all pb-1 text-sm font-bold text-gray-900 sm:pb-2 md:break-normal md:text-base"
    >
      {children}
    </motion.p>
  );
}
