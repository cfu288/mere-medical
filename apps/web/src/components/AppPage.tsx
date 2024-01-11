import React, { PropsWithChildren } from 'react';

export function AppPage(props: PropsWithChildren<{ banner: React.ReactNode }>) {
  return (
    <div className="mb-4 flex h-full flex-col sm:mb-2">
      {props.banner}
      <div className="flex-1 flex-grow overflow-x-hidden bg-gray-100">
        {props.children}
      </div>
    </div>
  );
}
