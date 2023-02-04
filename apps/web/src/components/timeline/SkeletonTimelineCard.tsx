import { memo } from 'react';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardBase } from './TimelineCardBase';

export function SkeletonTimelineCardUnmemoed() {
  return (
    <TimelineCardBase>
      <div className="w-full min-w-0 max-w-full flex-1">
        <div className="flex animate-pulse flex-row items-center pb-2">
          <div className="mt-1 h-4 w-12 rounded-md bg-gray-100 sm:h-4 "></div>
        </div>
        <span className="absolute inset-0" aria-hidden="true" />
        <div className="flex animate-pulse flex-row flex-wrap items-center gap-x-2">
          <div className="mt-1 h-3 w-24 rounded-md bg-gray-200 sm:h-4"></div>
          {/* <div className="mt-1 h-3 w-12 rounded-md bg-gray-200 sm:h-4"></div> */}
          <div className="mt-1 h-3 w-6 rounded-md bg-gray-200 sm:h-4"></div>
          <div className="mt-1 h-3 w-10 rounded-md bg-gray-200 sm:h-4"></div>
          {/* <div className="mt-1 h-3 w-4 rounded-md bg-gray-200 sm:h-4"></div>
          <div className="mt-1 h-3 w-6 rounded-md bg-gray-200 sm:h-4"></div>
          <div className="mt-1 h-3 w-12 rounded-md bg-gray-200 sm:h-4"></div> */}
        </div>
        <div className="flex animate-pulse flex-row items-center ">
          <div className="mt-3 mb-1 h-3 w-12 rounded-md bg-gray-200 sm:h-5"></div>
        </div>
        <SkeletonLoadingText />
      </div>
    </TimelineCardBase>
  );
}

export const SkeletonTimelineCard = memo(SkeletonTimelineCardUnmemoed);
