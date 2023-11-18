import React, { PropsWithChildren } from 'react';

export const AppPage = React.memo(function AppPage({
  banner,
  children,
}: PropsWithChildren<{ banner: React.ReactNode }>) {
  return (
    <div className="flex h-full flex-col">
      {banner}
      <div className="flex-1 flex-grow overflow-scroll">{children}</div>
    </div>
  );
});
