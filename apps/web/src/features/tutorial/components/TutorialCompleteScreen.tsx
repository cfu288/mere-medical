import React from 'react';
import { TutorialAction } from '../TutorialOverlay';
import { TutorialContentScreen } from './TutorialContentScreen';

export function TutorialCompleteScreen({
  dispatch,
}: {
  dispatch: React.Dispatch<TutorialAction>;
}) {
  return (
    <TutorialContentScreen dispatch={dispatch} isLastScreen>
      <h1 className="mb-4 text-center text-xl font-semibold">
        You're all set!
      </h1>
      <div className="mx-auto self-center justify-self-center rounded-lg p-2 align-middle sm:max-w-lg">
        <p className="mb-2">Enjoy using Mere to manage your health records!</p>
        <p className="mb-2">
          Mere is still in early beta, so if you have any feedback or
          suggestions, please send us an email at{' '}
          <a
            href="mailto:cfu288@meremedical.co"
            className="text-primary-100 hover:text-primary-50 inline underline"
          >
            cfu288@meremedical.co
          </a>{' '}
          to let us know.
        </p>
      </div>
    </TutorialContentScreen>
  );
}
