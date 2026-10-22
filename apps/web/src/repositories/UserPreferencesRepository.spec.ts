import { RxDatabase } from 'rxdb';
import { firstValueFrom } from 'rxjs';
import { skip } from 'rxjs/operators';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../test-utils/createTestDatabase';
import {
  createUserPreferencesIfNone,
  updateUserPreferences,
  watchUserPreferences,
} from './UserPreferencesRepository';

describe('UserPreferencesRepository', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('createUserPreferencesIfNone', () => {
    it('creates default preferences for a user who has none', async () => {
      const created = await createUserPreferencesIfNone(db, 'user-a');

      expect(created).toBe(true);
      expect(await firstValueFrom(watchUserPreferences(db, 'user-a'))).toEqual({
        id: expect.any(String),
        user_id: 'user-a',
        use_proxy: false,
      });
    });

    it('keeps the preferences a user already has', async () => {
      await db.user_preferences.insert({
        id: 'prefs-a',
        user_id: 'user-a',
        use_proxy: true,
      });

      const created = await createUserPreferencesIfNone(db, 'user-a');

      expect(created).toBe(false);
      expect(await firstValueFrom(watchUserPreferences(db, 'user-a'))).toEqual({
        id: 'prefs-a',
        user_id: 'user-a',
        use_proxy: true,
      });
    });
  });

  describe('watchUserPreferences', () => {
    it('emits the preferences of the user', async () => {
      await db.user_preferences.bulkInsert([
        { id: 'prefs-a', user_id: 'user-a', use_proxy: true },
        { id: 'prefs-b', user_id: 'user-b', use_proxy: false },
      ]);

      const result = await firstValueFrom(watchUserPreferences(db, 'user-a'));

      expect(result).toEqual({
        id: 'prefs-a',
        user_id: 'user-a',
        use_proxy: true,
      });
    });

    it('emits null when the user has no preferences', async () => {
      const result = await firstValueFrom(watchUserPreferences(db, 'user-a'));

      expect(result).toBeNull();
    });

    it('emits the preferences again after they change', async () => {
      await db.user_preferences.insert({
        id: 'prefs-a',
        user_id: 'user-a',
        use_proxy: false,
      });
      const next = firstValueFrom(
        watchUserPreferences(db, 'user-a').pipe(skip(1)),
      );

      await updateUserPreferences(db, 'user-a', { use_proxy: true });

      expect(await next).toEqual({
        id: 'prefs-a',
        user_id: 'user-a',
        use_proxy: true,
      });
    });
  });

  describe('updateUserPreferences', () => {
    it('changes the given fields of the user preferences', async () => {
      await db.user_preferences.insert({
        id: 'prefs-a',
        user_id: 'user-a',
        use_proxy: false,
      });

      await updateUserPreferences(db, 'user-a', { use_proxy: true });

      expect(await firstValueFrom(watchUserPreferences(db, 'user-a'))).toEqual({
        id: 'prefs-a',
        user_id: 'user-a',
        use_proxy: true,
      });
    });

    it('leaves the preferences of other users unchanged', async () => {
      await db.user_preferences.bulkInsert([
        { id: 'prefs-a', user_id: 'user-a', use_proxy: false },
        { id: 'prefs-b', user_id: 'user-b', use_proxy: false },
      ]);

      await updateUserPreferences(db, 'user-a', { use_proxy: true });

      expect(await firstValueFrom(watchUserPreferences(db, 'user-b'))).toEqual({
        id: 'prefs-b',
        user_id: 'user-b',
        use_proxy: false,
      });
    });

    it('creates preferences with the given fields when the user has none', async () => {
      await updateUserPreferences(db, 'user-a', { use_proxy: true });

      expect(await firstValueFrom(watchUserPreferences(db, 'user-a'))).toEqual({
        id: expect.any(String),
        user_id: 'user-a',
        use_proxy: true,
      });
    });
  });
});
