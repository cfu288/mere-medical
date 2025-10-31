import { useState, useCallback } from 'react';
import { useUser, useAllUsers, useUserManagement } from '../providers/UserProvider';
import { useNotificationDispatch } from '../providers/NotificationProvider';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { RxDocument } from 'rxdb';

export function useUserSwitchLogic(onClose: () => void) {
  const currentUser = useUser();
  const allUsers = useAllUsers();
  const { switchUser } = useUserManagement();
  const notificationDispatch = useNotificationDispatch();

  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [isSwitching, setIsSwitching] = useState(false);

  const resetSelection = useCallback(() => {
    setSelectedUserId(currentUser.id);
  }, [currentUser.id]);

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
  };

  const handleSwitchClick = async () => {
    if (selectedUserId === currentUser.id) return;

    setIsSwitching(true);
    try {
      await switchUser(selectedUserId);
      onClose();
    } catch (error) {
      notificationDispatch({
        type: 'set_notification',
        message: 'Failed to switch user. Please try again.',
        variant: 'error',
      });
    } finally {
      setIsSwitching(false);
    }
  };

  return {
    selectedUserId,
    isSwitching,
    handleUserSelect,
    handleSwitchClick,
    resetSelection,
  };
}

export function getUserDisplayName(user: RxDocument<UserDocument>) {
  const firstName = user.get('first_name');
  const lastName = user.get('last_name');
  if (firstName || lastName) {
    return `${firstName || ''} ${lastName || ''}`.trim();
  }
  return user.get('email') || 'Unnamed User';
}