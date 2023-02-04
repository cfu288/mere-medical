import { PropsWithChildren } from 'react';

export function TimelineCardTitle({ children }: PropsWithChildren) {
  return (
    <p className="break-all pb-2 text-sm font-bold capitalize text-gray-900 md:text-base">
      {String(children).toLowerCase()}
    </p>
  );
}
