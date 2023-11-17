import { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

export function MotionModalCategoryTitle({
  id,
  children,
}: PropsWithChildren<{ id?: string }>) {
  // Scales to 0 on y axis to hide
  return (
    <motion.div
      layoutId={id ? `card-category-title-${id}` : undefined}
      className="flex w-12 scale-y-0 transform flex-row items-center pb-1 align-middle text-sm font-bold opacity-0 sm:pb-2 md:text-base"
    >
      {children}
    </motion.div>
  );
}
