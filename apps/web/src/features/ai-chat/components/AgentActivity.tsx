import { ChevronRightIcon } from '@heroicons/react/24/outline';

import { usePeriodAnimation } from '../../../shared/hooks/usePeriodAnimation';
import { LogLine } from '../../patient-context/harness/describe';
import { RunActivity } from '../domain/chat-types';
import { ActivityTimeline } from './ActivityTimeline';

const CONTAINER =
  'ml-[42px] mt-6 w-full max-w-[320px] rounded-lg border border-gray-200 bg-white shadow-sm md:max-w-md lg:max-w-lg';

function LiveHeader({ current }: { current: string }) {
  const periodText = usePeriodAnimation();
  return (
    <span className="animate-pulse font-medium text-indigo-700">
      {current}
      {periodText}
    </span>
  );
}

export function AgentActivity(
  props:
    | { phase: 'live'; current: string; lines: LogLine[] }
    | { phase: 'settled'; activity: RunActivity },
) {
  if (props.phase === 'live') {
    return (
      <div className={CONTAINER}>
        <div className="flex items-center gap-2 px-3 py-2 text-xs">
          <LiveHeader current={props.current} />
        </div>
        {props.lines.length > 0 && (
          <div className="border-t border-gray-100 px-3 py-3">
            <ActivityTimeline lines={props.lines} />
          </div>
        )}
      </div>
    );
  }
  const { lines, turns, toolCalls, durationMs } = props.activity;
  return (
    <details className={`group ${CONTAINER}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-gray-500 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
        <span className="font-medium text-gray-700">
          Worked for {Math.round(durationMs / 1000)}s
        </span>
        <span>
          {turns} {turns === 1 ? 'turn' : 'turns'} · {toolCalls} tool{' '}
          {toolCalls === 1 ? 'call' : 'calls'}
        </span>
      </summary>
      <div className="border-t border-gray-100 px-3 py-3">
        <ActivityTimeline lines={lines} />
      </div>
    </details>
  );
}
