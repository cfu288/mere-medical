import { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

export function TimelineCardOpenButton({
  children,
  id,
}: PropsWithChildren<{ id?: string }>) {
  return (
    <motion.div layoutId={id ? `card-toggle-button-${id}` : undefined}>
      {children}
    </motion.div>
  );
}
