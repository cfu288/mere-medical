import React from 'react';
import { TutorialAction } from '../TutorialOverlay';
import { TutorialContentScreen } from './TutorialContentScreen';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

export function TutorialAddConnectionScreen({
  dispatch,
}: {
  dispatch: React.Dispatch<TutorialAction>;
}) {
  return (
    <TutorialContentScreen dispatch={dispatch}>
      <h1 className="mb-2 text-center text-xl font-semibold">
        Let's connect to one of your healthcare providers
      </h1>
      <div className="mx-auto self-center justify-self-center rounded-lg p-2 align-middle sm:max-w-lg">
        <p className="mb-2">
          To get started, you will need to connect Mere to a healthcare provider
          to download your medical records.
        </p>
        <p className="mb-2">
          After you complete the tutorial, click on the 'Connections'{' '}
          <span className="relative inline-flex w-6 px-1">
            <PlusCircleIcon className="absolute bottom-0 -mb-[2px] h-auto w-4" />
          </span>{' '}
          button to open the connections tab.
        </p>
        <p className="mb-2">
          From there, select the patient portal your healthcare provider uses.
        </p>
      </div>
    </TutorialContentScreen>
  );
}
