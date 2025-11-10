import { RxDatabase } from 'rxdb';
import { firstValueFrom } from 'rxjs';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { createTestDatabase, cleanupTestDatabase } from '../test-utils/createTestDatabase';
import * as UserPreferencesRepo from './UserPreferencesRepository';

describe('UserPreferencesRepository', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('query functions', () => {
    describe('getUserPreferences', () => {
      it('returns null when preferences do not exist', async () => {
        const prefs = await UserPreferencesRepo.getUserPreferences(db, 'user1');
        expect(prefs).toBeNull();
      });

      it('returns preferences when they exist', async () => {
        await db.user_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          use_proxy: false,
        });

        const prefs = await UserPreferencesRepo.getUserPreferences(db, 'user1');
        expect(prefs).toEqual({
          id: 'pref1',
          user_id: 'user1',
          use_proxy: false,
        });
      });

      it('returns null for wrong user', async () => {
        await db.user_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          use_proxy: true,
        });

        const prefs = await UserPreferencesRepo.getUserPreferences(db, 'user2');
        expect(prefs).toBeNull();
      });
    });

    describe('getUserPreferencesWithDefaults', () => {
      it('returns defaults when preferences do not exist', async () => {
        const prefs = await UserPreferencesRepo.getUserPreferencesWithDefaults(db, 'user1');

        expect(prefs.use_proxy).toBe(true); // Default value
        expect(prefs.user_id).toBe('user1');
        expect(prefs.id).toBeDefined(); // Should have an ID generated
      });

      it('returns stored values when preferences exist', async () => {
        await db.user_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          use_proxy: false,
        });

        const prefs = await UserPreferencesRepo.getUserPreferencesWithDefaults(db, 'user1');

        expect(prefs.use_proxy).toBe(false); // Stored value, not default
        expect(prefs.id).toBe('pref1');
        expect(prefs.user_id).toBe('user1');
      });

      it('returns defaults for wrong user even when other preferences exist', async () => {
        await db.user_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          use_proxy: false,
        });

        const prefs = await UserPreferencesRepo.getUserPreferencesWithDefaults(db, 'user2');

        expect(prefs.use_proxy).toBe(true); // Default value
        expect(prefs.user_id).toBe('user2');
      });
    });
  });

  describe('reactive functions', () => {
    describe('watchUserPreferences', () => {
      it('emits null initially when no preferences exist', async () => {
        const prefs$ = UserPreferencesRepo.watchUserPreferences(db, 'user1');
        const result = await firstValueFrom(prefs$);

        expect(result).toBeNull();
      });

      it('emits preferences when they exist', async () => {
        await db.user_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          use_proxy: false,
        });

        const prefs$ = UserPreferencesRepo.watchUserPreferences(db, 'user1');
        const result = await firstValueFrom(prefs$);

        expect(result).toEqual({
          id: 'pref1',
          user_id: 'user1',
          use_proxy: false,
        });
      });

      it('emits updates when preferences change', async () => {
        // Create initial preferences
        const doc = await db.user_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          use_proxy: true,
        });

        const prefs$ = UserPreferencesRepo.watchUserPreferences(db, 'user1');

        // Start collecting emissions
        const emissions: any[] = [];
        const subscription = prefs$.subscribe(value => emissions.push(value));

        // Wait for initial emission
        await new Promise(resolve => setTimeout(resolve, 50));

        // Update preferences
        await doc.update({ $set: { use_proxy: false } });

        // Wait for update emission
        await new Promise(resolve => setTimeout(resolve, 50));

        subscription.unsubscribe();

        expect(emissions.length).toBe(2);
        expect(emissions[0]?.use_proxy).toBe(true);
        expect(emissions[1]?.use_proxy).toBe(false);
      });

      it('does not emit for different user preferences', async () => {
        await db.user_preferences.insert({
          id: 'pref1',
          user_id: 'user2',
          use_proxy: true,
        });

        const prefs$ = UserPreferencesRepo.watchUserPreferences(db, 'user1');
        const result = await firstValueFrom(prefs$);

        expect(result).toBeNull();
      });
    });
  });

  describe('command functions', () => {
    describe('updateUserPreferences', () => {
      it('creates preferences if they do not exist', async () => {
        await UserPreferencesRepo.updateUserPreferences(db, 'user1', {
          use_proxy: false
        });

        const prefs = await UserPreferencesRepo.getUserPreferences(db, 'user1');
        expect(prefs).toBeDefined();
        expect(prefs?.use_proxy).toBe(false);
        expect(prefs?.user_id).toBe('user1');
      });

      it('updates existing preferences', async () => {
        await db.user_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          use_proxy: true,
        });

        await UserPreferencesRepo.updateUserPreferences(db, 'user1', {
          use_proxy: false
        });

        const prefs = await UserPreferencesRepo.getUserPreferences(db, 'user1');
        expect(prefs?.use_proxy).toBe(false);
        expect(prefs?.id).toBe('pref1'); // ID should not change
      });

      it('applies defaults when creating new preferences', async () => {
        await UserPreferencesRepo.updateUserPreferences(db, 'user1', {});

        const prefs = await UserPreferencesRepo.getUserPreferences(db, 'user1');
        expect(prefs?.use_proxy).toBe(true); // Default value
      });

      it('does not affect other users preferences', async () => {
        await db.user_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          use_proxy: true,
        });

        await db.user_preferences.insert({
          id: 'pref2',
          user_id: 'user2',
          use_proxy: true,
        });

        await UserPreferencesRepo.updateUserPreferences(db, 'user1', {
          use_proxy: false
        });

        const user1Prefs = await UserPreferencesRepo.getUserPreferences(db, 'user1');
        const user2Prefs = await UserPreferencesRepo.getUserPreferences(db, 'user2');

        expect(user1Prefs?.use_proxy).toBe(false);
        expect(user2Prefs?.use_proxy).toBe(true); // Unchanged
      });
    });

    describe('ensureUserPreferencesExist', () => {
      it('creates preferences with defaults if none exist', async () => {
        const created = await UserPreferencesRepo.ensureUserPreferencesExist(db, 'user1');

        expect(created).toBe(true);

        const prefs = await UserPreferencesRepo.getUserPreferences(db, 'user1');
        expect(prefs).toBeDefined();
        expect(prefs?.use_proxy).toBe(true); // Default value
        expect(prefs?.user_id).toBe('user1');
      });

      it('does not create preferences if they already exist', async () => {
        await db.user_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          use_proxy: false,
        });

        const created = await UserPreferencesRepo.ensureUserPreferencesExist(db, 'user1');

        expect(created).toBe(false);

        const prefs = await UserPreferencesRepo.getUserPreferences(db, 'user1');
        expect(prefs?.use_proxy).toBe(false); // Unchanged
        expect(prefs?.id).toBe('pref1'); // Same ID
      });

      it('creates preferences for each user independently', async () => {
        const created1 = await UserPreferencesRepo.ensureUserPreferencesExist(db, 'user1');
        const created2 = await UserPreferencesRepo.ensureUserPreferencesExist(db, 'user2');

        expect(created1).toBe(true);
        expect(created2).toBe(true);

        const prefs1 = await UserPreferencesRepo.getUserPreferences(db, 'user1');
        const prefs2 = await UserPreferencesRepo.getUserPreferences(db, 'user2');

        expect(prefs1?.user_id).toBe('user1');
        expect(prefs2?.user_id).toBe('user2');
        expect(prefs1?.id).not.toBe(prefs2?.id); // Different IDs
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty database gracefully', async () => {
      const prefs = await UserPreferencesRepo.getUserPreferences(db, 'nonexistent');
      expect(prefs).toBeNull();

      const prefsWithDefaults = await UserPreferencesRepo.getUserPreferencesWithDefaults(db, 'nonexistent');
      expect(prefsWithDefaults).toBeDefined();
      expect(prefsWithDefaults.use_proxy).toBe(true);
    });

    it('handles concurrent updates correctly', async () => {
      await UserPreferencesRepo.ensureUserPreferencesExist(db, 'user1');

      // Simulate concurrent updates - one may fail with conflict error which is expected
      const results = await Promise.allSettled([
        UserPreferencesRepo.updateUserPreferences(db, 'user1', { use_proxy: false }),
        UserPreferencesRepo.updateUserPreferences(db, 'user1', { use_proxy: true }),
      ]);

      // At least one should succeed
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThanOrEqual(1);

      // One of them should win
      const prefs = await UserPreferencesRepo.getUserPreferences(db, 'user1');
      expect(prefs).toBeDefined();
      expect(typeof prefs?.use_proxy).toBe('boolean');
    });
  });
});