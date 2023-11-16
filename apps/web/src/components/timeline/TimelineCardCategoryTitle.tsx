import { motion } from 'framer-motion';
import { ReactNode } from 'react';

export function TimelineCardCategoryTitle({
  title,
  color = 'gray',
  id,
}: {
  title: ReactNode;
  color: string;
  id?: string;
}) {
  return (
    <motion.div
      layoutId={id}
      className={`flex flex-row items-center pb-1 align-middle text-sm font-bold sm:pb-2 md:text-base ${color}`}
    >
      {title}
    </motion.div>
  );
}
