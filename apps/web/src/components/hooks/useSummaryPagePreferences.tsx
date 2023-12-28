import { useEffect, useRef, useState } from 'react';
import { RxDocument } from 'rxdb';
import { useRxDb } from '../providers/RxDbProvider';
import { SummaryPagePreferences } from '../../models/summary-page-preferences/SummaryPagePreferences.type';
import { Subscription } from 'rxjs';

export function useSummaryPagePreferences(userId: string) {
  const db = useRxDb(),
    [preferences, setPreferences] =
      useState<RxDocument<SummaryPagePreferences>>(),
    hasRun = useRef(false);

  useEffect(() => {
    let sub: Subscription;
    if (!hasRun.current && db && userId) {
      hasRun.current = true;
      sub = db.summary_page_preferences
        .findOne({
          selector: {
            user_id: userId,
          },
        })
        .$.subscribe((list) => {
          setPreferences(list as unknown as RxDocument<SummaryPagePreferences>);
        });
    }

    return () => sub?.unsubscribe();
  }, [db, userId]);

  return preferences;
}
