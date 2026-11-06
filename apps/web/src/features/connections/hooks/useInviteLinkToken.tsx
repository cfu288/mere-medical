import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppConfig } from '../../../app/providers/AppConfigProvider';
import { useUpdateLocalConfig } from '../../../app/providers/LocalConfigProvider';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { Routes } from '../../../Routes';
import {
  mereAdministrator,
  parseRegistrationToken,
} from '../registrationToken';

const FRAGMENT_PREFIX = '#registration-token=';

/**
 * Saves the registration token carried by an invite link (`/#registration-token=...`)
 * in this browser and removes it from the address bar. Runs on every location
 * change, which covers a link opened in an already open tab. The hook reports
 * a malformed link and keeps the saved token. The report waits for the instance
 * config, which names the contact.
 *
 * @returns nothing
 * @example useInviteLinkToken(); // in the root layout
 */
export function useInviteLinkToken() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const { config, isLoading } = useAppConfig();
  const updateLocalConfig = useUpdateLocalConfig();
  const notifyDispatch = useNotificationDispatch();
  const unreported = useRef<'saved' | 'invalid' | undefined>(undefined);

  useEffect(() => {
    if (hash.startsWith(FRAGMENT_PREFIX)) {
      const token = parseRegistrationToken(
        new URLSearchParams(hash.slice(1)).get('registration-token') ?? '',
      );
      if (token !== undefined) {
        updateLocalConfig({ registration_token: token });
        unreported.current = 'saved';
      } else {
        unreported.current = 'invalid';
      }
      navigate(
        { pathname: pathname === '/' ? Routes.Timeline : pathname, search },
        { replace: true },
      );
    }
    const outcome = unreported.current;
    if (isLoading || outcome === undefined) {
      return;
    }
    unreported.current = undefined;
    if (outcome === 'saved') {
      notifyDispatch({
        type: 'set_notification',
        variant: 'success',
        message: 'Invite link saved.',
      });
    } else {
      notifyDispatch({
        type: 'set_notification',
        variant: 'error',
        message: `This invite link is not valid. Ask ${mereAdministrator(config)} for a new one.`,
      });
    }
  }, [
    hash,
    pathname,
    search,
    navigate,
    updateLocalConfig,
    notifyDispatch,
    config,
    isLoading,
  ]);
}
