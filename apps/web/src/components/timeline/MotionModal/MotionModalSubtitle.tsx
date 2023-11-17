import { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

export function MotionModalSubtitle({
  id,
  children,
}: PropsWithChildren<{ id?: string }>): JSX.Element {
  return (
    <motion.div
      layoutId={id ? `card-subtitle-${id}` : undefined}
      className="text-sm font-light"
    >
      {children}
    </motion.div>
  );
}
