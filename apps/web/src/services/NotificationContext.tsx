import { Transition } from '@headlessui/react';
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/20/solid';
import * as React from 'react';

type NotificationType = 'error' | 'success';

type Action =
  | { type: 'set_notification'; message: string; variant: NotificationType }
  | { type: 'hide_notification' };

type Dispatch = (action: Action) => void;

export type NotificationData = {
  message?: string;
  showNotification: boolean;
  variant: NotificationType;
};

type NotificationProviderProps = {
  children: React.ReactNode;
  providedDispatch?: Dispatch;
  providedState?: NotificationData;
};

const NotificationDispatchContext = React.createContext<Dispatch | undefined>(
  undefined
);

function notificationReducer(state: NotificationData, action: Action) {
  switch (action.type) {
    case 'set_notification': {
      return {
        ...state,
        showNotification: true,
        message: action.message,
        variant: action.variant,
      };
    }
    case 'hide_notification': {
      return { ...state, showNotification: false };
    }
    default: {
      throw new Error(`Unhandled action type: ${action}`);
    }
  }
}

function NotificationRenderer(
  props: React.PropsWithChildren<{ data: NotificationData }>
) {
  const dispatch = useNotificationDispatch();

  return (
    <>
      {props.children}
      {/* Global notification live region, render this permanently at the end of the document */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6"
      >
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          {/* Notification panel, dynamically insert this into the live region when it needs to be displayed */}
          <Transition
            show={props.data.showNotification}
            as={React.Fragment}
            enter="transform ease-out duration-300 transition"
            enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
            enterTo="translate-y-0 opacity-100 sm:translate-x-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {props.data.variant === 'error' && (
                      <XMarkIcon
                        className="h-6 w-6 text-red-400"
                        aria-hidden="true"
                      />
                    )}
                    {props.data.variant === 'success' && (
                      <CheckCircleIcon
                        className="h-6 w-6 text-green-400"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="ml-3 w-0 flex-1 pt-0.5">
                    {props.data.message && (
                      <p className="text-sm font-medium text-gray-900">
                        {props.data.message}
                      </p>
                    )}
                    {/* <p className="mt-1 text-sm text-gray-500">
                      Anyone with a link can now view this file.
                    </p> */}
                  </div>
                  <div className="ml-4 flex flex-shrink-0">
                    <button
                      type="button"
                      className="focus:ring-primary-700 inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2"
                      onClick={() => {
                        dispatch({ type: 'hide_notification' });
                      }}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </>
  );
}

/**
 * HOC that handles rendering notifications. A new notification can be sent using the `useNotificationDispatch()` hook
 */
function NotificationProvider({
  children,
  providedDispatch,
  providedState,
}: NotificationProviderProps) {
  const [state, dispatch] = React.useReducer(notificationReducer, {
    message: '',
    showNotification: false,
    variant: 'success',
  });

  return (
    <NotificationDispatchContext.Provider value={providedDispatch || dispatch}>
      <NotificationRenderer data={providedState || state}>
        {children}
      </NotificationRenderer>
    </NotificationDispatchContext.Provider>
  );
}

function useNotificationDispatch() {
  const context = React.useContext(NotificationDispatchContext);
  if (context === undefined) {
    throw new Error(
      'useNotificationDispatch must be used within a NotificationProvider'
    );
  }

  return context;
}

export { NotificationProvider, useNotificationDispatch };
