import { PropsWithChildren } from 'react';

export function TimelineCardSubtitile({
  children,
  variant,
}: PropsWithChildren<{ variant: 'light' | 'dark' }>) {
  return (
    <p
      className={`truncate text-xs font-medium md:text-sm ${
        variant === 'light' ? 'text-gray-400 ' : 'text-gray-500'
      }`}
    >
      {children}
    </p>
  );
}
