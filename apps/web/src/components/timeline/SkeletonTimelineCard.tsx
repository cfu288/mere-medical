import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardBase } from './TimelineCardBase';

export function SkeletonTimelineCard() {
  return (
    <TimelineCardBase>
      <div className="w-full min-w-0 max-w-full flex-1">
        <div className="flex animate-pulse flex-row items-center pb-2">
          <div className="mt-1 h-4 w-12 rounded-md bg-gray-100 md:h-4 "></div>
        </div>
        <span className="absolute inset-0" aria-hidden="true" />
        <div className="flex animate-pulse flex-row flex-wrap items-center gap-x-2">
          <div className="mt-1 h-4 w-24 rounded-md bg-gray-200 md:h-4"></div>
          <div className="mt-1 h-4 w-12 rounded-md bg-gray-200 md:h-4"></div>
          <div className="mt-1 h-4 w-6 rounded-md bg-gray-200 md:h-4"></div>
          <div className="mt-1 h-4 w-10 rounded-md bg-gray-200 md:h-4"></div>
          <div className="mt-1 h-4 w-4 rounded-md bg-gray-200 md:h-4"></div>
          <div className="mt-1 h-4 w-6 rounded-md bg-gray-200 md:h-4"></div>
          <div className="mt-1 h-4 w-12 rounded-md bg-gray-200 md:h-4"></div>
        </div>
        <div className="flex animate-pulse flex-row items-center">
          <div className="mt-4 h-4 w-12 rounded-md bg-gray-200 "></div>
        </div>
        <SkeletonLoadingText />
      </div>
    </TimelineCardBase>
  );
}
