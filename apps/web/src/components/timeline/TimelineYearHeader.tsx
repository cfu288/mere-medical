import { format, parseISO } from 'date-fns';
import React from 'react';
import { checkIfDefaultDate } from '../../pages/TimelineTab';

export function TimelineYearHeader({
  year,
  fullDate,
}: {
  year: string;
  fullDate: string;
}) {
  return (
    <div className="sticky top-4 z-10 flex flex-col bg-transparent mt-4 h-6">
      <div className="flex flex-row py-1">
        <div className="relative flex flex-col">
          <div className="h-0 mt-0 bg-transparent">
            {!checkIfDefaultDate(fullDate) ? (
              <p className="px-2 text-xl font-black bg-gray-700 border-2 border-gray-700 rounded-md text-center text-white">{`${format(
                parseISO(year),
                'yyyy',
              )}`}</p>
            ) : (
              <p className="px-2 text-xl font-black bg-gray-700 border-2 border-gray-700 rounded-md text-center text-white">
                No Date
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
