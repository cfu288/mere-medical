import React from 'react';
import { TutorialAction } from './TutorialOverlay';
import { TutorialContentScreen } from './TutorialContentScreen';

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
        You can connect to a healthcare provider to download your medical
        records. Click on the 'Connections' tab and select the patient portal
        your healthcare provider uses.
      </p>
    </TutorialContentScreen>
  );
}
