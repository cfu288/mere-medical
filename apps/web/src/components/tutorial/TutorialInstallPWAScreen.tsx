import React, { useEffect } from 'react';
import { TutorialAction } from './TutorialOverlay';
import { TutorialContentScreen } from './TutorialContentScreen';
import install from '../../assets/img/install.png';

export function TutorialInstallPWAScreen({
  dispatch,
}: {
  dispatch: React.Dispatch<TutorialAction>;
}) {
  const isSafari = () => {
      return (
        /Safari/.test(navigator.userAgent) &&
        /Apple Computer/.test(navigator.vendor)
      );
    },
    isChrome = () => {
      let isChromeVendor = false;
      if ((navigator as Navigator & { userAgentData: any })?.userAgentData) {
        const vendors = (window.navigator as Navigator & { userAgentData: any })
          .userAgentData.brands;
        if (
          vendors?.filter((e: any) => e.brand === 'Google Chrome').length > 0
        ) {
          isChromeVendor = true;
        }
      }
      return (
        /Chrome/.test(navigator.userAgent) &&
        /Google Inc/.test(navigator.vendor) &&
        isChromeVendor
      );
    },
    isFirefox = () => {
      return /Firefox/.test(navigator.userAgent);
    },
    isMobileDevice = () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
    },
    isUnknownBrowser = () => {
      return !isSafari() && !isChrome() && !isFirefox();
    };

  return (
    <TutorialContentScreen dispatch={dispatch}>
      {isSafari() && (
        <>
          <h1 className="mb-2 text-center text-xl font-semibold">
            We see you're using an Apple device
          </h1>
          <div className="mb-4">
            {isMobileDevice() ? (
              <p className="text-center">
                For the best experience, you should{' '}
                <b>install Mere as an app</b> on your homescreen.
              </p>
            ) : (
              <p className="text-center">
                For the best experience, you should{' '}
                <b>install Mere as an app</b> on your computer.
              </p>
            )}
            {isSafari() ? (
              <p className="text-center font-bold">
                If you do not install Mere as an app, Safari will clear your
                data after 7 days.
              </p>
            ) : null}
          </div>
          {/* installation instructions */}
          {!isMobileDevice() && (
            <div className="border-1 mx-auto self-center justify-self-center  rounded-lg border border-white p-2 align-middle">
              <h1 className="mb-2 text-xl font-semibold underline">
                Installation Instructions
              </h1>
              <ol className="list-decimal">
                <li className="ml-6">
                  In the top right corner of your browser, click the share{' '}
                  <span className="inline-flex px-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="h-full w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15"
                      />
                    </svg>
                  </span>{' '}
                  button.
                </li>
                <li className="ml-6">
                  In the share menu, you should see the option to 'Add to Dock'.
                </li>
                <li className="ml-6">
                  Click the 'Add' button to install Mere on your computer.
                </li>
              </ol>
            </div>
          )}
          {isMobileDevice() && (
            <div className="border-1 mx-auto self-center justify-self-center  rounded-lg border border-white p-2 align-middle">
              <h1 className="mb-2 text-xl font-semibold underline">
                Installation Instructions
              </h1>
              <ol className="list-decimal">
                <li className="ml-6 mb-2">
                  In the bottom middle bar of Safari, click the share{' '}
                  <span className="inline-flex px-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="h-full w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15"
                      />
                    </svg>
                  </span>{' '}
                  button.
                </li>
                <li className="ml-6 mb-2">
                  In the share menu, you should see the option to 'Add to Home
                  Screen'.
                </li>
                <li className="ml-6 mb-2">
                  Click the 'Add' button to install Mere on your computer.
                </li>
              </ol>
            </div>
          )}
        </>
      )}
      {isChrome() && (
        <>
          <h1 className="mb-2 text-center text-xl font-semibold">
            {isMobileDevice()
              ? 'Install the App'
              : 'Install the Mere App on your Computer'}
          </h1>
          <div className="mb-4">
            {isMobileDevice() ? (
              <p className="text-center">
                For the best experience, you can install Mere as an app on your
                homescreen.
              </p>
            ) : (
              <p className="text-center">
                For the best experience, you can install Mere as an app on your
                computer.
              </p>
            )}
          </div>
          {/* installation instructions */}
          {!isMobileDevice() && (
            <div className="border-1 mx-auto self-center justify-self-center  rounded-lg border border-white p-2 align-middle">
              <h1 className="mb-2 text-xl font-semibold underline">
                Installation Instructions
              </h1>
              <ol className="list-decimal">
                <li className="ml-6">
                  In the top right corner inside the URL bar, click the install
                  <img
                    className="mb-1 inline-flex h-4 w-auto px-1 invert"
                    src={install}
                    alt="install icon"
                  />
                  button.
                </li>
                <li className="ml-6">
                  You should see the "Install App?" dialog box.
                </li>
                <li className="ml-6">
                  Click the 'install' button to install Mere on your computer.
                </li>
              </ol>
            </div>
          )}
          {isMobileDevice() && (
            <div className="border-1 mx-auto self-center justify-self-center  rounded-lg border border-white p-2 align-middle">
              <h1 className="mb-2 text-xl font-semibold underline">
                Installation Instructions
              </h1>
              <ol className="list-decimal">
                <li className="ml-6">
                  When promped by Chrome, click the 'Add Mere to your Home
                  screen' dialog to install the app on your phone.
                </li>{' '}
                <li className="ml-6">
                  If you do not get a prompt by Chrome, you can manually install
                  it by clicking the three dots{' '}
                  <span className="inline-flex px-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="h-full w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                      />
                    </svg>
                  </span>{' '}
                  in the top right corner of Chrome and selecting 'Install app'.
                </li>
              </ol>
            </div>
          )}
        </>
      )}
      {isFirefox() && (
        <>
          <h1 className="mb-2 text-center text-xl font-semibold">
            {isMobileDevice()
              ? 'Install the App'
              : 'Install the Mere App on your Computer'}
          </h1>
          <div className="mx-auto mb-4 self-center justify-self-center rounded-lg p-2 align-middle sm:max-w-lg">
            <p className="mb-2">
              Unfortunately, Firefox does not support installing PWAs.
            </p>
            <p className="mb-2">
              You can{' '}
              <a
                className="text-blue-100 underline hover:text-blue-50"
                href="https://addons.mozilla.org/en-US/firefox/addon/pwas-for-firefox/"
              >
                install an extension
              </a>{' '}
              to add support for installing PWAs like Mere.
            </p>
          </div>
        </>
      )}
      {isUnknownBrowser() && (
        // unkown browser, show generic instructions telling user to look up how to install a PWA if their browser supports it
        <>
          <h1 className="mb-2 text-center text-xl font-semibold">
            {isMobileDevice()
              ? 'Install the App'
              : 'Install the Mere App on your Computer'}
          </h1>
          <div className="mx-auto mb-4 self-center justify-self-center rounded-lg p-2 align-middle sm:max-w-lg">
            <p className="mb-2">
              Unfortunately, your browser may not support installing Mere as a
              Progressive Web Application (PWA).
            </p>
            <p className="mb-2">
              To see how to install PWAs in the most commonly supported
              browsers, you can{' '}
              <a
                className="text-blue-400 hover:text-blue-500"
                href="https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing"
                target="_blank"
                rel="noreferrer"
              >
                check out this website
              </a>
              .
            </p>
          </div>
        </>
      )}
    </TutorialContentScreen>
  );
}
