import { useEffect, useState } from 'react';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { SummaryPagePreferences } from '../../../models/summary-page-preferences/SummaryPagePreferences.type';
import { watchSummaryPagePreferences } from '../../../repositories/SummaryPagePreferencesRepository';

export function useSummaryPagePreferences(userId: string) {
  const db = useRxDb(),
    [preferences, setPreferences] = useState<SummaryPagePreferences | null>();

  useEffect(() => {
    if (!db || !userId) {
      return;
    }
    const sub = watchSummaryPagePreferences(db, userId).subscribe(
      setPreferences,
    );
    return () => sub.unsubscribe();
  }, [db, userId]);

  return preferences;
}
