import { format, parseISO } from 'date-fns';
import React from 'react';

export function TimelineYearHeader({ year }: { year: string }) {
  return (
    <div className="sticky left-0 right-0 top-0 z-10 mt-1 flex flex-col bg-gray-100 sm:mt-4">
      <div className="relative flex flex-row py-1">
        <div className="z-11 absolute -top-2 h-2 w-full bg-gradient-to-t from-gray-100  to-transparent"></div>
        <span className="flex grow"></span>
        <div className="w-full">
          <p className="pt-2 text-xl font-black sm:pt-4">{`Timeline of ${format(
            parseISO(year),
            'yyyy'
          )}`}</p>
        </div>
        <div className="absolute -bottom-4 h-4 w-full bg-gradient-to-b from-gray-100 to-transparent"></div>
      </div>
    </div>
  );
}
