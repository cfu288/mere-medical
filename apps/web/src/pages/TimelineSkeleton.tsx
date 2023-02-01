import React, { memo } from 'react';
import { SkeletonTimelineCard } from '../components/timeline/SkeletonTimelineCard';
import { SkeletonTimelineYearHeader } from './SkeletonTimelineYearHeader';
import { SkeletonSearchBar } from './SkeletonSearchBar';
import { JumpToPanel } from '../components/timeline/JumpToPanel';

function TimelineSkeletonUnmemoed() {
  return (
    <div className={`relative flex`}>
      <JumpToPanel isLoading={true} />
      <div className="mx-auto flex w-full max-w-4xl flex-col overflow-x-clip px-4 pb-12 sm:px-6 lg:px-8">
        <SkeletonSearchBar />
        {[...Array(2)].map(() => (
          <>
            <SkeletonTimelineYearHeader />
            <div className="flex scroll-mt-10 flex-row gap-x-4 px-0 pt-8 md:px-2">
              {/* Left sided date */}
              <div className="mt-2 flex h-6 grow animate-pulse flex-row items-center justify-end pt-5">
                <div className="h-6 w-12 rounded-md bg-gray-100"></div>
              </div>
              {/* Spacer between date and card */}
              <div className="flex-column relative flex justify-center pt-5 font-black text-gray-300">
                <div className="">•</div>
              </div>
              {/* Clinical card rendering */}
              <div className="flex w-4/5 flex-col gap-y-2 md:w-3/4">
                <SkeletonTimelineCard />
                <SkeletonTimelineCard />
              </div>
            </div>
            <div className="flex scroll-mt-10 flex-row gap-x-4 px-0 pt-8 md:px-2">
              {/* Left sided date */}
              <div className="mt-2 flex h-6 grow animate-pulse flex-row items-center justify-end pt-5">
                <div className="h-6 w-12 rounded-md bg-gray-100"></div>
              </div>
              {/* Spacer between date and card */}
              <div className="flex-column relative flex justify-center pt-5 font-black text-gray-300">
                <div className="">•</div>
              </div>
              {/* Clinical card rendering */}
              <div className="flex w-4/5 flex-col gap-y-2 md:w-3/4">
                <SkeletonTimelineCard />
                <SkeletonTimelineCard />
                <SkeletonTimelineCard />
                <SkeletonTimelineCard />
              </div>
            </div>
          </>
        ))}
      </div>
    </div>
  );
}

export const TimelineSkeleton = memo(TimelineSkeletonUnmemoed);
