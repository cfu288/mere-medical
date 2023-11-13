import React from 'react';
import { TutorialAction } from './TutorialOverlay';
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
      <p className="text-center">
        To get started, you will need to connect to a healthcare provider to
        download your medical records.
      </p>
      <p className="text-center">
        After you complete the tutorial, click on the 'Connections'{' '}
        <span className="relative inline-flex w-6 px-1">
          <PlusCircleIcon className="absolute bottom-0 -mb-[2px] h-auto w-4" />
        </span>{' '}
        button to open the connections tab.
      </p>
      <p className="text-center">
        From there, select the patient portal your healthcare provider uses.
      </p>
    </TutorialContentScreen>
  );
}
