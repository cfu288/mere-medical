import { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

export function MotionModal({
  children,
  id,
}: PropsWithChildren<{ id?: string }>) {
  return (
    <>
      <motion.div className="relative z-50">
        {/* Background opacity */}
        <motion.div
          layout
          layoutId={id ? `card-background-${id}` : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gray-500"
        />
        {/* Modal */}
        <motion.div
          layout
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto pt-12 sm:p-12"
        >
          <motion.div
            layoutId={`card-base-${id}`}
            className="mx-auto w-screen rounded-xl border bg-white shadow-2xl sm:w-auto sm:min-w-[50%] sm:max-w-3xl"
          >
            <motion.div className="flex flex-col">{children}</motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </>
  );
}
