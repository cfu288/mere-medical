import { RxDatabase } from 'rxdb';
import { firstValueFrom } from 'rxjs';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../test-utils/createTestDatabase';
import * as SummaryPrefsRepo from './SummaryPreferencesRepository';
import { SummaryPagePreferencesCard } from '../models/summary-page-preferences/SummaryPagePreferences.type';

describe('SummaryPreferencesRepository', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('query functions', () => {
    describe('getSummaryPreferences', () => {
      it('returns null when preferences do not exist', async () => {
        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs).toBeNull();
      });

      it('returns preferences when they exist', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1', 'lab2'],
        });

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs).toEqual({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1', 'lab2'],
        });
      });

      it('returns null for wrong user', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1'],
        });

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user2');
        expect(prefs).toBeNull();
      });
    });

    describe('getCardsWithDefaults', () => {
      it('returns defaults when preferences do not exist', async () => {
        const cards = await SummaryPrefsRepo.getCardsWithDefaults(db, 'user1');

        expect(cards).toEqual(SummaryPrefsRepo.DEFAULT_CARD_ORDER);
        expect(cards.length).toBe(7);
        expect(cards[0].type).toBe('recommendations');
      });

      it('returns stored cards when preferences exist', async () => {
        const customCards: SummaryPagePreferencesCard[] = [
          { type: 'pinned', order: 0, is_visible: true },
          { type: 'medications', order: 1, is_visible: false },
        ];

        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          cards: customCards,
        });

        const cards = await SummaryPrefsRepo.getCardsWithDefaults(db, 'user1');

        expect(cards).toEqual(customCards);
        expect(cards.length).toBe(2);
      });

      it('returns defaults when cards field is undefined', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1'],
        });

        const cards = await SummaryPrefsRepo.getCardsWithDefaults(db, 'user1');
        expect(cards).toEqual(SummaryPrefsRepo.DEFAULT_CARD_ORDER);
      });

      it('returns defaults for wrong user even when other preferences exist', async () => {
        const customCards: SummaryPagePreferencesCard[] = [
          { type: 'pinned', order: 0, is_visible: true },
        ];

        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          cards: customCards,
        });

        const cards = await SummaryPrefsRepo.getCardsWithDefaults(db, 'user2');
        expect(cards).toEqual(SummaryPrefsRepo.DEFAULT_CARD_ORDER);
      });
    });
  });

  describe('reactive functions', () => {
    describe('watchSummaryPreferences', () => {
      it('emits null initially when no preferences exist', async () => {
        const prefs$ = SummaryPrefsRepo.watchSummaryPreferences(db, 'user1');
        const result = await firstValueFrom(prefs$);

        expect(result).toBeNull();
      });

      it('emits preferences when they exist', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1', 'lab2'],
        });

        const prefs$ = SummaryPrefsRepo.watchSummaryPreferences(db, 'user1');
        const result = await firstValueFrom(prefs$);

        expect(result).toEqual({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1', 'lab2'],
        });
      });

      it('emits updates when preferences change', async () => {
        const doc = await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1'],
        });

        const prefs$ = SummaryPrefsRepo.watchSummaryPreferences(db, 'user1');

        const emissions: any[] = [];
        const subscription = prefs$.subscribe((value) => emissions.push(value));

        await new Promise((resolve) => setTimeout(resolve, 50));

        await doc.update({ $set: { pinned_labs: ['lab1', 'lab2', 'lab3'] } });

        await new Promise((resolve) => setTimeout(resolve, 50));

        subscription.unsubscribe();

        expect(emissions.length).toBe(2);
        expect(emissions[0]?.pinned_labs).toEqual(['lab1']);
        expect(emissions[1]?.pinned_labs).toEqual(['lab1', 'lab2', 'lab3']);
      });

      it('does not emit for different user preferences', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user2',
          pinned_labs: ['lab1'],
        });

        const prefs$ = SummaryPrefsRepo.watchSummaryPreferences(db, 'user1');
        const result = await firstValueFrom(prefs$);

        expect(result).toBeNull();
      });
    });
  });

  describe('command functions', () => {
    describe('ensureSummaryPreferencesExist', () => {
      it('creates preferences if none exist', async () => {
        const created = await SummaryPrefsRepo.ensureSummaryPreferencesExist(
          db,
          'user1'
        );

        expect(created).toBe(true);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs).toBeDefined();
        expect(prefs?.user_id).toBe('user1');
        expect(prefs?.pinned_labs).toEqual([]);
      });

      it('does not create preferences if they already exist', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1'],
        });

        const created = await SummaryPrefsRepo.ensureSummaryPreferencesExist(
          db,
          'user1'
        );

        expect(created).toBe(false);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.pinned_labs).toEqual(['lab1']);
        expect(prefs?.id).toBe('pref1');
      });

      it('creates preferences for each user independently', async () => {
        const created1 = await SummaryPrefsRepo.ensureSummaryPreferencesExist(
          db,
          'user1'
        );
        const created2 = await SummaryPrefsRepo.ensureSummaryPreferencesExist(
          db,
          'user2'
        );

        expect(created1).toBe(true);
        expect(created2).toBe(true);

        const prefs1 = await SummaryPrefsRepo.getSummaryPreferences(
          db,
          'user1'
        );
        const prefs2 = await SummaryPrefsRepo.getSummaryPreferences(
          db,
          'user2'
        );

        expect(prefs1?.user_id).toBe('user1');
        expect(prefs2?.user_id).toBe('user2');
        expect(prefs1?.id).not.toBe(prefs2?.id);
      });
    });

    describe('updateSummaryPreferences', () => {
      it('creates preferences if they do not exist', async () => {
        await SummaryPrefsRepo.updateSummaryPreferences(db, 'user1', {
          pinned_labs: ['lab1', 'lab2'],
        });

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs).toBeDefined();
        expect(prefs?.pinned_labs).toEqual(['lab1', 'lab2']);
        expect(prefs?.user_id).toBe('user1');
      });

      it('updates existing preferences', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1'],
        });

        await SummaryPrefsRepo.updateSummaryPreferences(db, 'user1', {
          pinned_labs: ['lab2', 'lab3'],
        });

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.pinned_labs).toEqual(['lab2', 'lab3']);
        expect(prefs?.id).toBe('pref1');
      });

      it('does not affect other users preferences', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1'],
        });

        await db.summary_page_preferences.insert({
          id: 'pref2',
          user_id: 'user2',
          pinned_labs: ['lab2'],
        });

        await SummaryPrefsRepo.updateSummaryPreferences(db, 'user1', {
          pinned_labs: ['lab3'],
        });

        const user1Prefs = await SummaryPrefsRepo.getSummaryPreferences(
          db,
          'user1'
        );
        const user2Prefs = await SummaryPrefsRepo.getSummaryPreferences(
          db,
          'user2'
        );

        expect(user1Prefs?.pinned_labs).toEqual(['lab3']);
        expect(user2Prefs?.pinned_labs).toEqual(['lab2']);
      });
    });

    describe('upsertPinnedLabs', () => {
      it('creates preferences with pinned labs if none exist', async () => {
        await SummaryPrefsRepo.upsertPinnedLabs(db, 'user1', [
          'lab1',
          'lab2',
          'lab3',
        ]);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.pinned_labs).toEqual(['lab1', 'lab2', 'lab3']);
      });

      it('replaces existing pinned labs array', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['old1', 'old2'],
        });

        await SummaryPrefsRepo.upsertPinnedLabs(db, 'user1', [
          'new1',
          'new2',
          'new3',
        ]);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.pinned_labs).toEqual(['new1', 'new2', 'new3']);
      });

      it('can set empty array', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1', 'lab2'],
        });

        await SummaryPrefsRepo.upsertPinnedLabs(db, 'user1', []);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.pinned_labs).toEqual([]);
      });
    });

    describe('togglePinnedLab', () => {
      it('adds lab when not pinned', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1'],
        });

        const isPinned = await SummaryPrefsRepo.togglePinnedLab(
          db,
          'user1',
          'lab2'
        );

        expect(isPinned).toBe(true);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.pinned_labs).toEqual(['lab1', 'lab2']);
      });

      it('removes lab when already pinned', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1', 'lab2', 'lab3'],
        });

        const isPinned = await SummaryPrefsRepo.togglePinnedLab(
          db,
          'user1',
          'lab2'
        );

        expect(isPinned).toBe(false);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.pinned_labs).toEqual(['lab1', 'lab3']);
      });

      it('creates preferences if none exist and adds lab', async () => {
        const isPinned = await SummaryPrefsRepo.togglePinnedLab(
          db,
          'user1',
          'lab1'
        );

        expect(isPinned).toBe(true);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.pinned_labs).toEqual(['lab1']);
      });

      it('handles toggling same lab multiple times', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: [],
        });

        const isPinned1 = await SummaryPrefsRepo.togglePinnedLab(
          db,
          'user1',
          'lab1'
        );
        expect(isPinned1).toBe(true);

        const isPinned2 = await SummaryPrefsRepo.togglePinnedLab(
          db,
          'user1',
          'lab1'
        );
        expect(isPinned2).toBe(false);

        const isPinned3 = await SummaryPrefsRepo.togglePinnedLab(
          db,
          'user1',
          'lab1'
        );
        expect(isPinned3).toBe(true);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.pinned_labs).toEqual(['lab1']);
      });
    });

    describe('updateCardPreferences', () => {
      it('updates cards when preferences exist', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: [],
        });

        const newCards: SummaryPagePreferencesCard[] = [
          { type: 'pinned', order: 0, is_visible: true },
          { type: 'medications', order: 1, is_visible: false },
        ];

        await SummaryPrefsRepo.updateCardPreferences(db, 'user1', newCards);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.cards).toEqual(newCards);
      });

      it('creates preferences when they do not exist', async () => {
        const newCards: SummaryPagePreferencesCard[] = [
          { type: 'pinned', order: 0, is_visible: true },
        ];

        await SummaryPrefsRepo.updateCardPreferences(db, 'user1', newCards);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs).not.toBeNull();
        expect(prefs?.cards).toEqual(newCards);
        expect(prefs?.user_id).toBe('user1');
        expect(prefs?.pinned_labs).toEqual([]);
      });

      it('replaces existing cards', async () => {
        const initialCards: SummaryPagePreferencesCard[] = [
          { type: 'pinned', order: 0, is_visible: true },
          { type: 'medications', order: 1, is_visible: true },
        ];

        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          cards: initialCards,
        });

        const newCards: SummaryPagePreferencesCard[] = [
          { type: 'allergies', order: 0, is_visible: false },
        ];

        await SummaryPrefsRepo.updateCardPreferences(db, 'user1', newCards);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.cards).toEqual(newCards);
      });
    });

    describe('upsertCardPreferences', () => {
      it('creates preferences with cards if none exist', async () => {
        const newCards: SummaryPagePreferencesCard[] = [
          { type: 'pinned', order: 0, is_visible: true },
          { type: 'medications', order: 1, is_visible: false },
        ];

        await SummaryPrefsRepo.upsertCardPreferences(db, 'user1', newCards);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.cards).toEqual(newCards);
        expect(prefs?.pinned_labs).toEqual([]);
      });

      it('updates cards when preferences exist', async () => {
        const initialCards: SummaryPagePreferencesCard[] = [
          { type: 'pinned', order: 0, is_visible: true },
        ];

        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          cards: initialCards,
          pinned_labs: ['lab1'],
        });

        const newCards: SummaryPagePreferencesCard[] = [
          { type: 'allergies', order: 0, is_visible: false },
          { type: 'medications', order: 1, is_visible: true },
        ];

        await SummaryPrefsRepo.upsertCardPreferences(db, 'user1', newCards);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.cards).toEqual(newCards);
        expect(prefs?.pinned_labs).toEqual(['lab1']);
        expect(prefs?.id).toBe('pref1');
      });

      it('preserves other fields when upserting cards', async () => {
        await db.summary_page_preferences.insert({
          id: 'pref1',
          user_id: 'user1',
          pinned_labs: ['lab1', 'lab2', 'lab3'],
        });

        const newCards: SummaryPagePreferencesCard[] = [
          { type: 'pinned', order: 0, is_visible: true },
        ];

        await SummaryPrefsRepo.upsertCardPreferences(db, 'user1', newCards);

        const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
        expect(prefs?.cards).toEqual(newCards);
        expect(prefs?.pinned_labs).toEqual(['lab1', 'lab2', 'lab3']);
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty database gracefully', async () => {
      const prefs = await SummaryPrefsRepo.getSummaryPreferences(
        db,
        'nonexistent'
      );
      expect(prefs).toBeNull();

      const cards = await SummaryPrefsRepo.getCardsWithDefaults(
        db,
        'nonexistent'
      );
      expect(cards).toEqual(SummaryPrefsRepo.DEFAULT_CARD_ORDER);
    });

    it('handles concurrent pinned lab toggles correctly', async () => {
      await SummaryPrefsRepo.ensureSummaryPreferencesExist(db, 'user1');

      const results = await Promise.allSettled([
        SummaryPrefsRepo.togglePinnedLab(db, 'user1', 'lab1'),
        SummaryPrefsRepo.togglePinnedLab(db, 'user1', 'lab2'),
        SummaryPrefsRepo.togglePinnedLab(db, 'user1', 'lab3'),
      ]);

      const successes = results.filter((r) => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThanOrEqual(1);

      const prefs = await SummaryPrefsRepo.getSummaryPreferences(db, 'user1');
      expect(prefs).toBeDefined();
      expect(Array.isArray(prefs?.pinned_labs)).toBe(true);
    });

    it('maintains user isolation for pinned labs', async () => {
      await db.summary_page_preferences.insert({
        id: 'pref1',
        user_id: 'user1',
        pinned_labs: ['lab1', 'lab2'],
      });

      await db.summary_page_preferences.insert({
        id: 'pref2',
        user_id: 'user2',
        pinned_labs: ['lab3', 'lab4'],
      });

      await SummaryPrefsRepo.togglePinnedLab(db, 'user1', 'lab3');

      const user1Prefs = await SummaryPrefsRepo.getSummaryPreferences(
        db,
        'user1'
      );
      const user2Prefs = await SummaryPrefsRepo.getSummaryPreferences(
        db,
        'user2'
      );

      expect(user1Prefs?.pinned_labs).toEqual(['lab1', 'lab2', 'lab3']);
      expect(user2Prefs?.pinned_labs).toEqual(['lab3', 'lab4']);
    });

    it('maintains user isolation for cards', async () => {
      const user1Cards: SummaryPagePreferencesCard[] = [
        { type: 'pinned', order: 0, is_visible: true },
      ];
      const user2Cards: SummaryPagePreferencesCard[] = [
        { type: 'medications', order: 0, is_visible: false },
      ];

      await db.summary_page_preferences.insert({
        id: 'pref1',
        user_id: 'user1',
        cards: user1Cards,
      });

      await db.summary_page_preferences.insert({
        id: 'pref2',
        user_id: 'user2',
        cards: user2Cards,
      });

      const newUser1Cards: SummaryPagePreferencesCard[] = [
        { type: 'allergies', order: 0, is_visible: true },
      ];

      await SummaryPrefsRepo.upsertCardPreferences(db, 'user1', newUser1Cards);

      const user1Prefs = await SummaryPrefsRepo.getSummaryPreferences(
        db,
        'user1'
      );
      const user2Prefs = await SummaryPrefsRepo.getSummaryPreferences(
        db,
        'user2'
      );

      expect(user1Prefs?.cards).toEqual(newUser1Cards);
      expect(user2Prefs?.cards).toEqual(user2Cards);
    });
  });
});
