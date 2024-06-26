import React from 'react';

export function SkeletonTimelineYearHeader() {
  return (
    <div className="sticky top-4 z-10 flex flex-col bg-transparent mt-4 h-6">
      <div className="flex flex-row py-1">
        <div className="relative flex flex-col">
          <div className="h-0 mt-0 bg-transparent">
            <p className="px-2 w-16 truncate text-nowrap text-xl font-black bg-gray-700 border-2 border-gray-700 rounded-md text-center text-gray-700 animate-pulse">
              Date
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
