import { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

export function MotionModalTitle({
  id,
  children,
}: PropsWithChildren<{ id?: string }>) {
  return (
    <motion.p
      layoutId={id ? `card-title-${id}` : undefined}
      className="w-full text-xl font-bold"
    >
      {children}
    </motion.p>
  );
}
