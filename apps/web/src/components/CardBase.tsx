import { motion } from 'framer-motion';
import { PropsWithChildren } from 'react';

interface WrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  isFocusable?: boolean;
  id?: string;
  forwardRef?: React.RefObject<HTMLDivElement>;
}

export function CardBase({
  id,
  children,
  isFocusable = false,
  forwardRef: forRef,
  ...props
}: PropsWithChildren<WrapperProps>) {
  const newProps = { ...props };
  if (id) {
    (newProps as any).id = id;
  }
  return (
    // @ts-ignore
    <motion.div
      layout
      layoutId={id ? `card-base-${id}` : undefined}
      ref={forRef}
      {...newProps}
      className={`max-width-full flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-3 py-3 shadow-sm md:px-6 md:py-5 ${
        isFocusable
          ? `focus:ring-primary-50 ring-white duration-75 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[98%] active:bg-slate-50 active:ring-0 active:ring-white`
          : ''
      }`}
      tabIndex={isFocusable ? 0 : -1}
    >
      {children}
    </motion.div>
  );
}
