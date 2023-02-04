import { PropsWithChildren } from 'react';

interface WrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  isFocusable?: boolean;
}

export function TimelineCardBase({
  children,
  isFocusable = true,
  ...props
}: PropsWithChildren<WrapperProps>) {
  return (
    <div
      {...props}
      className={`max-width-full relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-4 py-4 shadow-sm md:px-6 md:py-5 ${
        isFocusable
          ? `focus-within:ring-primary-500 focus:ring-primary-700 focus-within:ring-2 focus-within:ring-offset-2`
          : ''
      }`}
    >
      {children}
    </div>
  );
}
