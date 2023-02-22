import { PropsWithChildren } from 'react';

export function TimelineCardTitle({ children }: PropsWithChildren) {
  return (
    <div className="break-all pb-1 text-sm font-bold text-gray-900 sm:pb-2 md:break-normal md:text-base">
      {children}
    </div>
  );
}
