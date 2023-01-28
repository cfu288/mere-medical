import { PropsWithChildren } from 'react';

export function TimelineCardBase({
  children,
  ...props
}: PropsWithChildren<{ [x: string]: unknown }>) {
  return (
    <div
      {...props}
      className="focus-within:ring-primary-500 focus:ring-primary-700 relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-4 py-4 shadow-sm focus-within:ring-2 focus-within:ring-offset-2 md:px-6 md:py-5"
    >
      {children}
    </div>
  );
}
