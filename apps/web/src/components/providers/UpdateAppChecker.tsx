import { useNotificationDispatch } from './NotificationProvider';
import { useEffect } from 'react';

export function UpdateAppChecker() {
  const notificationDispatch = useNotificationDispatch();

  useEffect(() => {
    const listener = async (event: MessageEvent<any>) => {
      // Optional: ensure the message came from workbox-broadcast-update
      if (event.data.meta === 'workbox-broadcast-update') {
        notificationDispatch({
          message: `Mere is ready to update! Restart the app to see the latest version.`,
          variant: 'info',
          type: 'set_notification',
        });
      }
    };
    navigator.serviceWorker.addEventListener('message', listener);

    return () => {
      navigator.serviceWorker.removeEventListener('message', listener);
    };
  }, [notificationDispatch]);

  return null;
}
