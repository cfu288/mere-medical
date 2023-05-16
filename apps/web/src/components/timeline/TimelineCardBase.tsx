import { PropsWithChildren } from 'react';

interface WrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  isFocusable?: boolean;
}

export function TimelineCardBase({
  children,
  isFocusable = false,
  ...props
}: PropsWithChildren<WrapperProps>) {
  return (
    <div
      {...props}
      className={`max-width-full relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-3 py-3 shadow-sm md:px-6 md:py-5 ${
        isFocusable
          ? `focus:ring-primary-700 duration-75 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[98%] active:bg-slate-50`
          : ''
      }`}
      tabIndex={isFocusable ? 0 : -1}
    >
      {children}
    </div>
  );
}
