import { useMemo } from 'react';
import { useRxDb } from '../../components/providers/RxDbProvider';
import * as UserPreferencesRepo from '../UserPreferencesRepository';
import { UserPreferencesDocument } from '../../models/user-preferences/UserPreferences.type';

export const useUserPreferencesRepository = () => {
  const db = useRxDb();

  return useMemo(() => {
    if (!db) return null;

    return {
      getUserPreferences: (userId: string) =>
        UserPreferencesRepo.getUserPreferences(db, userId),
      getUserPreferencesWithDefaults: (userId: string) =>
        UserPreferencesRepo.getUserPreferencesWithDefaults(db, userId),
      watchUserPreferences: (userId: string) =>
        UserPreferencesRepo.watchUserPreferences(db, userId),
      updateUserPreferences: (
        userId: string,
        preferences: Partial<Omit<UserPreferencesDocument, 'id' | 'user_id'>>
      ) => UserPreferencesRepo.updateUserPreferences(db, userId, preferences),
      ensureUserPreferencesExist: (userId: string) =>
        UserPreferencesRepo.ensureUserPreferencesExist(db, userId),
    };
  }, [db]);
};