import { PropsWithChildren } from 'react';

export function TimelineCardTitle({ children }: PropsWithChildren) {
  return (
    <p className="break-all pb-2 text-sm font-bold text-gray-900 md:break-normal md:text-base">
      {String(children)}
    </p>
  );
}
