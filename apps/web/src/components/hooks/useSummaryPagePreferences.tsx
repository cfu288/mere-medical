import { useEffect, useRef, useState } from 'react';
import { useRxDb } from '../providers/RxDbProvider';
import { SummaryPagePreferences } from '../../models/summary-page-preferences/SummaryPagePreferences.type';
import { Subscription } from 'rxjs';
import * as SummaryPrefsRepo from '../../repositories/SummaryPreferencesRepository';

export function useSummaryPagePreferences(
  userId: string
): SummaryPagePreferences | null {
  const db = useRxDb();
  const [preferences, setPreferences] = useState<SummaryPagePreferences | null>(
    null
  );
  const hasRun = useRef(false);

  useEffect(() => {
    let sub: Subscription | undefined;

    if (!hasRun.current && db && userId) {
      hasRun.current = true;

      SummaryPrefsRepo.ensureSummaryPreferencesExist(db, userId).then(() => {
        sub = SummaryPrefsRepo.watchSummaryPreferences(db, userId).subscribe(
          (prefs) => {
            setPreferences(prefs);
          }
        );
      });
    }

    return () => {
      sub?.unsubscribe();
    };
  }, [db, userId]);

  return preferences;
}
