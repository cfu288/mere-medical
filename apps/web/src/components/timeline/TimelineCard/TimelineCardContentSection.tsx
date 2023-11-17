import { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

export function TimelineCardContentSection({
  children,
  id,
}: PropsWithChildren<{ id?: string }>) {
  return (
    <motion.div
      layoutId={id ? `card-content-${id}` : undefined}
      className="h-0 w-full overflow-hidden opacity-0"
    >
      {children}
    </motion.div>
  );
}
