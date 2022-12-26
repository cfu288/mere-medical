import React, { PropsWithChildren } from 'react';

export function AppPage(props: PropsWithChildren<{ banner: React.ReactNode }>) {
  return (
    <div className="flex h-screen flex-col">
      {props.banner}
      <div className="h-full flex-1 flex-grow overflow-y-scroll pb-24">
        {props.children}
      </div>
    </div>
  );
}