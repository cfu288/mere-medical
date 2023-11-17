import React, { PropsWithChildren } from 'react';

export function AppPage({
  banner,
  disableOverflow = true,
  children,
}: PropsWithChildren<{ banner: React.ReactNode; disableOverflow?: boolean }>) {
  return (
    <div className="z-50 flex h-full flex-col">
      {banner}
      <div
        className={`flex-1 flex-grow ${
          disableOverflow ? 'overflow-visible' : 'overflow-x-hidden'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
