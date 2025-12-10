import { PropsWithChildren } from 'react';

export function TimelineCardSubtitile({
  children,
  variant,
  truncate = true,
}: PropsWithChildren<{ variant: 'light' | 'dark'; truncate?: boolean }>) {
  return (
    <p
      className={`text-xs font-medium md:text-sm ${
        variant === 'light' ? 'text-gray-700 ' : 'text-gray-800'
      } ${truncate ? 'truncate' : ''}`}
    >
      {children}
    </p>
  );
}
