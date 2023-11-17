import { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

export function TimelineCardSubtitileSection({
  children,
  id,
}: PropsWithChildren<{ id?: string }>) {
  return (
    <motion.div layoutId={id ? `card-subtitle-${id}` : undefined}>
      {children}
    </motion.div>
  );
}
