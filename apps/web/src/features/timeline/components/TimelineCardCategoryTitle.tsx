import { ReactNode } from 'react';

export function TimelineCardCategoryTitle({
  title,
  color = 'gray',
}: {
  title: ReactNode;
  color: string;
}) {
  return (
    <div
      className={`pb-1 text-sm font-bold sm:pb-2 flex flex-row items-center align-middle md:text-base ${color}`}
    >
      {title}
    </div>
  );
}
