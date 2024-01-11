import { PropsWithChildren } from 'react';

export function TimelineCardSubtitile({
  children,
  variant,
  truncate = true,
}: PropsWithChildren<{ variant: 'light' | 'dark'; truncate?: boolean }>) {
  return (
    <p
      className={`text-xs font-medium md:text-sm ${
        variant === 'light' ? 'text-gray-400 ' : 'text-gray-700'
      } ${truncate ? 'truncate' : ''}`}
    >
      {children}
    </p>
  );
}
