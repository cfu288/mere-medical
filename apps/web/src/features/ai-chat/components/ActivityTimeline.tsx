import {
  CommandLineIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid';

import { LogLine } from '../../patient-context/harness/describe';

const BADGES = {
  chat: { icon: SparklesIcon, background: 'bg-indigo-500' },
  tool: { icon: CommandLineIcon, background: 'bg-gray-400' },
  info: { icon: InformationCircleIcon, background: 'bg-gray-300' },
  error: { icon: ExclamationTriangleIcon, background: 'bg-red-500' },
} as const;

function StepText({
  line,
  expandable,
}: {
  line: LogLine;
  expandable: boolean;
}) {
  const color = line.kind === 'error' ? 'text-red-600' : 'text-gray-600';
  const affordance = expandable
    ? ' underline decoration-dotted decoration-gray-300 underline-offset-2'
    : '';
  return (
    <span className={`font-mono text-[11px] leading-4 ${color}${affordance}`}>
      {line.text}
    </span>
  );
}

function StepTime({ time }: { time: string }) {
  return (
    <time className="whitespace-nowrap font-mono text-[11px] leading-4 text-gray-400">
      {time}
    </time>
  );
}

export function ActivityTimeline({ lines }: { lines: LogLine[] }) {
  return (
    <div className="flow-root">
      <ul className="-mb-3">
        {lines.map((line, index) => {
          const badge = BADGES[line.kind];
          return (
            <li key={line.id} className="relative pb-3">
              {index !== lines.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-2.5 top-2.5 -ml-px h-full w-px bg-gray-200"
                />
              )}
              <div className="relative flex gap-2.5">
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-full ring-4 ring-white ${badge.background}`}
                >
                  <badge.icon className="h-3 w-3 text-white" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  {line.detail ? (
                    <details>
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
                        <StepText line={line} expandable />
                        <StepTime time={line.time} />
                      </summary>
                      <pre className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded-md border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] leading-4 text-gray-700">
                        {line.detail}
                      </pre>
                    </details>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <StepText line={line} expandable={false} />
                      <StepTime time={line.time} />
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
