import { RxDatabase } from 'rxdb';
import { firstValueFrom } from 'rxjs';
import { skip } from 'rxjs/operators';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../test-utils/createTestDatabase';
import {
  findSummaryPagePreferences,
  togglePinnedLab,
  watchSummaryPagePreferences,
} from './SummaryPagePreferencesRepository';

describe('SummaryPagePreferencesRepository', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('findSummaryPagePreferences', () => {
    it('returns the preferences of the user', async () => {
      await db.summary_page_preferences.bulkInsert([
        { id: 'prefs-a', user_id: 'user-a', pinned_labs: ['lab-1'] },
        { id: 'prefs-b', user_id: 'user-b', pinned_labs: ['lab-2'] },
      ]);

      const result = await findSummaryPagePreferences(db, 'user-a');

      expect(result).toEqual({
        id: 'prefs-a',
        user_id: 'user-a',
        pinned_labs: ['lab-1'],
      });
    });

    it('returns null when the user has no preferences', async () => {
      const result = await findSummaryPagePreferences(db, 'user-a');

      expect(result).toBeNull();
    });
  });

  describe('watchSummaryPagePreferences', () => {
    it('emits the preferences of the user', async () => {
      await db.summary_page_preferences.insert({
        id: 'prefs-a',
        user_id: 'user-a',
        pinned_labs: ['lab-1'],
      });

      const result = await firstValueFrom(
        watchSummaryPagePreferences(db, 'user-a'),
      );

      expect(result).toEqual({
        id: 'prefs-a',
        user_id: 'user-a',
        pinned_labs: ['lab-1'],
      });
    });

    it('emits null when the user has no preferences', async () => {
      const result = await firstValueFrom(
        watchSummaryPagePreferences(db, 'user-a'),
      );

      expect(result).toBeNull();
    });

    it('emits the preferences again after the pinned labs change', async () => {
      await db.summary_page_preferences.insert({
        id: 'prefs-a',
        user_id: 'user-a',
        pinned_labs: ['lab-1'],
      });
      const next = firstValueFrom(
        watchSummaryPagePreferences(db, 'user-a').pipe(skip(1)),
      );

      await togglePinnedLab(db, 'user-a', 'lab-1');

      expect(await next).toEqual({
        id: 'prefs-a',
        user_id: 'user-a',
        pinned_labs: [],
      });
    });
  });

  describe('togglePinnedLab', () => {
    it('adds the record to the pinned labs of the user', async () => {
      await db.summary_page_preferences.insert({
        id: 'prefs-a',
        user_id: 'user-a',
        pinned_labs: ['lab-1'],
        cards: [{ type: 'pinned', order: 0, is_visible: true }],
      });

      await togglePinnedLab(db, 'user-a', 'lab-2');

      expect(await findSummaryPagePreferences(db, 'user-a')).toEqual({
        id: 'prefs-a',
        user_id: 'user-a',
        pinned_labs: ['lab-1', 'lab-2'],
        cards: [{ type: 'pinned', order: 0, is_visible: true }],
      });
    });

    it('removes a pinned record from the pinned labs of the user', async () => {
      await db.summary_page_preferences.insert({
        id: 'prefs-a',
        user_id: 'user-a',
        pinned_labs: ['lab-1', 'lab-2'],
      });

      await togglePinnedLab(db, 'user-a', 'lab-1');

      expect(await findSummaryPagePreferences(db, 'user-a')).toEqual({
        id: 'prefs-a',
        user_id: 'user-a',
        pinned_labs: ['lab-2'],
      });
    });

    it('leaves the preferences of other users unchanged', async () => {
      await db.summary_page_preferences.bulkInsert([
        { id: 'prefs-a', user_id: 'user-a', pinned_labs: ['lab-1'] },
        { id: 'prefs-b', user_id: 'user-b', pinned_labs: ['lab-1'] },
      ]);

      await togglePinnedLab(db, 'user-a', 'lab-1');

      expect(await findSummaryPagePreferences(db, 'user-b')).toEqual({
        id: 'prefs-b',
        user_id: 'user-b',
        pinned_labs: ['lab-1'],
      });
    });

    it('creates preferences holding the record when the user has none', async () => {
      await togglePinnedLab(db, 'user-a', 'lab-1');

      expect(await findSummaryPagePreferences(db, 'user-a')).toEqual({
        id: expect.any(String),
        user_id: 'user-a',
        pinned_labs: ['lab-1'],
      });
    });
  });
});
