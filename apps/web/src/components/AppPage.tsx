import React, { PropsWithChildren } from 'react';

export function AppPage(props: PropsWithChildren<{ banner: React.ReactNode }>) {
  return (
    <div className="flex h-full flex-col pb-4 sm:pb-2">
      {props.banner}
      <div className="flex-1 flex-grow overflow-x-hidden">{props.children}</div>
    </div>
  );
}
