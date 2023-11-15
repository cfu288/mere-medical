import React, { PropsWithChildren } from 'react';

export function AppPage(props: PropsWithChildren<{ banner: React.ReactNode }>) {
  return (
    <div className="flex h-full flex-col">
      {props.banner}
      <div className="mb-[50px] flex-1 flex-grow overflow-x-hidden sm:mb-0">
        {props.children}
      </div>
    </div>
  );
}
