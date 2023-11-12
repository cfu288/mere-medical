import React from 'react';
import { TutorialAction } from './TutorialOverlay';
import { TutorialContentScreen } from './TutorialContentScreen';
import logo from '../../img/white-logo.svg';

export function TutorialWelcomeScreen({
  dispatch,
}: {
  dispatch: React.Dispatch<TutorialAction>;
}) {
  return (
    <TutorialContentScreen dispatch={dispatch}>
      <h1 className="mb-2 text-center text-xl font-semibold">
        Welcome to Mere!
      </h1>
      <p className="text-center">Lets start organizing your medical records.</p>
      <img
        className="mx-auto mt-12 h-12 w-12 self-center md:h-24 md:w-24"
        src={logo}
        alt="Logo"
      ></img>
    </TutorialContentScreen>
  );
}
