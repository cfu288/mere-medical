import { useNotificationDispatch } from './NotificationProvider';
import { useEffect } from 'react';

export function UpdateAppChecker() {
  const notificationDispatch = useNotificationDispatch();

  useEffect(() => {
    if (localStorage.getItem('updateReady') === 'true') {
      notificationDispatch({
        message: `Mere is ready to update! Restart the app to see the latest version.`,
        variant: 'info',
        type: 'set_notification',
      });
      localStorage.removeItem('updateReady');
    }
  }, [notificationDispatch]);

  return null;
}
