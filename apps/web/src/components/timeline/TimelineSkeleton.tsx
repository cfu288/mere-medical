import React, { Fragment, memo } from 'react';
import { SkeletonTimelineCard } from './SkeletonTimelineCard';
import { SkeletonTimelineYearHeader } from './SkeletonTimelineYearHeader';
import { SkeletonSearchBar } from '../hooks/SkeletonSearchBar';
import { JumpToPanel } from './JumpToPanel';

function TimelineSkeletonUnmemoed() {
  return (
    <div className={`relative flex`}>
      <JumpToPanel isLoading={true} />
      <div className="relative mx-auto flex w-full max-w-4xl flex-col overflow-x-clip px-4 pb-12 sm:px-6 lg:px-8">
        <SkeletonSearchBar />
        {[...Array(2)].map((_, index) => (
          <Fragment key={index}>
            <SkeletonTimelineYearHeader />
            <div className="flex scroll-mt-10 flex-row gap-x-4 px-0 pt-4 sm:pt-8 md:px-2">
              {/* Left sided date */}
              <div className="mt-2 flex h-6 grow animate-pulse items-center justify-end gap-x-4 pt-5">
                <div className="h-6 w-12 rounded-md bg-gray-200"></div>
                <div className="text-gray-700">•</div>
              </div>
              {/* Clinical card rendering */}
              <div className="md:w-3/4 flex w-4/5 flex-col gap-y-2">
                <SkeletonTimelineCard />
                <SkeletonTimelineCard />
              </div>
            </div>
            <div className="flex scroll-mt-10 flex-row gap-x-4 px-0 pt-4 sm:pt-8 md:px-2">
              {/* Left sided date */}
              <div className="mt-2 flex h-6 grow animate-pulse flex-row items-center justify-end pt-5">
                <div className="h-6 w-12 rounded-md bg-gray-200"></div>
              </div>
              {/* Spacer between date and card */}
              <div className="flex-column relative flex justify-center pt-5 font-black text-gray-700">
                <div className="">•</div>
              </div>
              {/* Clinical card rendering */}
              <div className="md:w-3/4 flex w-4/5 flex-col gap-y-2">
                <SkeletonTimelineCard />
                <SkeletonTimelineCard />
                <SkeletonTimelineCard />
                <SkeletonTimelineCard />
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export const TimelineSkeleton = memo(TimelineSkeletonUnmemoed);
