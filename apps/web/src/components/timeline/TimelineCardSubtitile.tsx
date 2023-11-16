import { motion } from 'framer-motion';
import { PropsWithChildren } from 'react';

export function TimelineCardSubtitile({
  children,
  variant,
  id,
}: PropsWithChildren<{ variant: 'light' | 'dark'; id?: string }>) {
  return (
    <motion.p
      className={`truncate text-xs font-medium md:text-sm ${
        variant === 'light' ? 'text-gray-400 ' : 'text-gray-500'
      }`}
    >
      {children}
    </motion.p>
  );
}
