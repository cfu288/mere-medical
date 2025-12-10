import { PropsWithChildren } from 'react';

interface WrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  isFocusable?: boolean;
  removePadding?: boolean;
}

export function CardBase({
  children,
  isFocusable = false,
  removePadding,
  ...props
}: PropsWithChildren<WrapperProps>) {
  return (
    <div
      {...props}
      className={`max-width-full relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white shadow-sm ${
        removePadding ? '' : 'px-3 py-3 md:px-6 md:py-5'
      } ${
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
