import React from 'react';
import { TutorialAction } from './TutorialOverlay';
import { TutorialContentScreen } from './TutorialContentScreen';

export function TutorialWelcomeScreen({
  dispatch,
}: {
  dispatch: React.Dispatch<TutorialAction>;
}) {
  return (
    <TutorialContentScreen dispatch={dispatch}>
      <h1 className="text-center text-xl font-semibold">Welcome to Mere!</h1>
      <p className="text-center">Lets start organizing your medical records.</p>
    </TutorialContentScreen>
  );
}
