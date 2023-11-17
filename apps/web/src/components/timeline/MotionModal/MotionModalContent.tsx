import { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

export function MotionModalContent({
  id,
  children,
}: PropsWithChildren<{ id?: string }>) {
  return (
    <motion.div
      layoutId={id ? `card-content-${id}` : undefined}
      className="flex flex-col"
    >
      {children}
    </motion.div>
  );
}
