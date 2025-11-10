import { useMemo } from 'react';
import { useRxDb } from '../../components/providers/RxDbProvider';
import * as SummaryPrefsRepo from '../SummaryPreferencesRepository';
import {
  SummaryPagePreferences,
  SummaryPagePreferencesCard,
} from '../../models/summary-page-preferences/SummaryPagePreferences.type';

export const useSummaryPreferencesRepository = () => {
  const db = useRxDb();

  return useMemo(() => {
    if (!db) return null;

    return {
      getSummaryPreferences: (userId: string) =>
        SummaryPrefsRepo.getSummaryPreferences(db, userId),
      getCardsWithDefaults: (userId: string) =>
        SummaryPrefsRepo.getCardsWithDefaults(db, userId),
      watchSummaryPreferences: (userId: string) =>
        SummaryPrefsRepo.watchSummaryPreferences(db, userId),
      ensureSummaryPreferencesExist: (userId: string) =>
        SummaryPrefsRepo.ensureSummaryPreferencesExist(db, userId),
      updateSummaryPreferences: (
        userId: string,
        preferences: Partial<Omit<SummaryPagePreferences, 'id' | 'user_id'>>
      ) => SummaryPrefsRepo.updateSummaryPreferences(db, userId, preferences),
      upsertPinnedLabs: (userId: string, pinnedLabs: string[]) =>
        SummaryPrefsRepo.upsertPinnedLabs(db, userId, pinnedLabs),
      togglePinnedLab: (userId: string, labId: string) =>
        SummaryPrefsRepo.togglePinnedLab(db, userId, labId),
      updateCardPreferences: (
        userId: string,
        cards: SummaryPagePreferencesCard[]
      ) => SummaryPrefsRepo.updateCardPreferences(db, userId, cards),
      upsertCardPreferences: (
        userId: string,
        cards: SummaryPagePreferencesCard[]
      ) => SummaryPrefsRepo.upsertCardPreferences(db, userId, cards),
    };
  }, [db]);
};
