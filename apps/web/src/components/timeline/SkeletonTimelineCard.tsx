import { TimelineCardBase } from './TimelineCardBase';

export function SkeletonTimelineCard() {
  return (
    <TimelineCardBase>
      <div className="min-w-0 flex-1">
        <div className="flex animate-pulse flex-row items-center">
          <div className="mt-1 h-3 w-12 rounded-sm bg-gray-100 md:h-4 "></div>
        </div>
        <span className="absolute inset-0" aria-hidden="true" />
        <div className="flex animate-pulse flex-row items-center gap-x-2">
          <div className="mt-1 h-3 w-24 rounded-sm bg-gray-100 md:h-4"></div>
          <div className="mt-1 h-3 w-12 rounded-sm bg-gray-100 md:h-4"></div>
          <div className="mt-1 h-3 w-16 rounded-sm bg-gray-100 md:h-4"></div>
        </div>
        <div className="flex animate-pulse flex-row items-center">
          <div className="mt-1 h-3 w-20 rounded-sm bg-gray-100 md:h-4 "></div>
        </div>
        <div className="flex h-4 animate-pulse flex-row items-center">
          <div className="mt-1 h-3 w-36 rounded-sm bg-gray-100 "></div>
        </div>
      </div>
    </TimelineCardBase>
  );
}
