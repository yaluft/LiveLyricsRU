import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, type TestDb } from '../db/testing.js';
import { srsCards, srsReviews, vocabEntries } from '../db/schema.js';
import { dueCards, dueCount, isReviewRating, listVocabulary, removeWord, reviewCard, saveWord } from './srs.js';

let ctx: TestDb;

beforeEach(async () => {
  ctx = await createTestDb();
});

afterEach(() => {
  ctx.close();
});

describe('isReviewRating', () => {
  it('accepts the four grades a reviewer can give', () => {
    for (const rating of [1, 2, 3, 4]) expect(isReviewRating(rating)).toBe(true);
  });

  it('rejects anything else, including FSRS "Manual" (0)', () => {
    for (const rating of [0, 5, -1, 1.5, Number.NaN]) {
      expect(isReviewRating(rating), String(rating)).toBe(false);
    }
  });
});

describe('saveWord', () => {
  it('creates a review card at save time', async () => {
    // v2 had a "Учить N" button with no handler and saved vocabulary was a
    // dead list. Creating the card on save is what makes it a queue.
    const entry = await saveWord(ctx.db, { lemma: 'гаснуть', surfaceForm: 'гаснет' });

    const [card] = await ctx.db
      .select()
      .from(srsCards)
      .where(eq(srsCards.vocabEntryId, entry.id));

    expect(card).toBeDefined();
    expect(card?.reps).toBe(0);
    expect(card?.due).toBeGreaterThan(0);
  });

  it('normalises the lemma so ё and case do not create separate entries', async () => {
    const entry = await saveWord(ctx.db, { lemma: 'Ёжик', surfaceForm: 'Ёжик' });
    expect(entry.lemma).toBe('ежик');
  });

  it('re-saving the same word updates where it was seen instead of duplicating', async () => {
    await saveWord(ctx.db, { lemma: 'гаснуть', surfaceForm: 'гаснет' });
    await saveWord(ctx.db, { lemma: 'гаснуть', surfaceForm: 'гасли' });

    const rows = await ctx.db.select().from(vocabEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.surfaceForm).toBe('гасли');
  });

  it('does not reset an existing card when the word is met again', async () => {
    const entry = await saveWord(ctx.db, { lemma: 'гаснуть', surfaceForm: 'гаснет' });
    const [card] = await ctx.db.select().from(srsCards).where(eq(srsCards.vocabEntryId, entry.id));
    await reviewCard(ctx.db, card!.id, 3);

    await saveWord(ctx.db, { lemma: 'гаснуть', surfaceForm: 'гасли' });

    const [after] = await ctx.db.select().from(srsCards).where(eq(srsCards.id, card!.id));
    expect(after?.reps).toBe(1);
  });
});

describe('reviewCard', () => {
  async function seedCard(): Promise<number> {
    const entry = await saveWord(ctx.db, { lemma: 'свет', surfaceForm: 'свет' });
    const [card] = await ctx.db.select().from(srsCards).where(eq(srsCards.vocabEntryId, entry.id));
    return card!.id;
  }

  it('returns null for an unknown card', async () => {
    expect(await reviewCard(ctx.db, 9999, 3)).toBeNull();
  });

  it('advances reps and schedules the next review', async () => {
    const cardId = await seedCard();
    const result = await reviewCard(ctx.db, cardId, 3);

    expect(result).not.toBeNull();
    const [card] = await ctx.db.select().from(srsCards).where(eq(srsCards.id, cardId));
    expect(card?.reps).toBe(1);
    expect(card?.lastReview).toBeGreaterThan(0);
  });

  it('schedules "easy" further out than "again"', async () => {
    const easy = await reviewCard(ctx.db, await seedCard(), 4);
    const again = await reviewCard(ctx.db, await seedCard(), 1);

    expect(easy!.due).toBeGreaterThan(again!.due);
  });

  it('appends to the review log rather than overwriting it', async () => {
    // The log is what makes FSRS parameters re-optimisable later; keeping only
    // the current card state would make that impossible.
    const cardId = await seedCard();
    await reviewCard(ctx.db, cardId, 3);
    await reviewCard(ctx.db, cardId, 2);
    await reviewCard(ctx.db, cardId, 4);

    const log = await ctx.db.select().from(srsReviews).where(eq(srsReviews.cardId, cardId));
    expect(log).toHaveLength(3);
    expect(log.map((row) => row.rating)).toEqual([3, 2, 4]);
  });

  it('preserves learning_steps across a review', async () => {
    // Without this column FSRS restarts the learning sequence every time,
    // because it is handed a card that claims to be at step zero.
    const cardId = await seedCard();
    await reviewCard(ctx.db, cardId, 1);
    const [card] = await ctx.db.select().from(srsCards).where(eq(srsCards.id, cardId));

    expect(card?.learningSteps).toBeTypeOf('number');
  });
});

describe('queues', () => {
  it('counts and lists only cards that are actually due', async () => {
    const entry = await saveWord(ctx.db, { lemma: 'свет', surfaceForm: 'свет' });
    expect(await dueCount(ctx.db)).toBe(1);

    // Push it a day out and it should leave the queue.
    await ctx.db
      .update(srsCards)
      .set({ due: Date.now() + 86_400_000 })
      .where(eq(srsCards.vocabEntryId, entry.id));

    expect(await dueCount(ctx.db)).toBe(0);
    expect(await dueCards(ctx.db)).toHaveLength(0);
  });

  it('lists vocabulary with its card state attached', async () => {
    await saveWord(ctx.db, { lemma: 'свет', surfaceForm: 'свет' });
    const [row] = await listVocabulary(ctx.db);

    expect(row?.lemma).toBe('свет');
    expect(row?.due).toBeTypeOf('number');
  });

  it('removing a word takes its card and history with it', async () => {
    const entry = await saveWord(ctx.db, { lemma: 'свет', surfaceForm: 'свет' });
    await removeWord(ctx.db, entry.id);

    expect(await ctx.db.select().from(vocabEntries)).toHaveLength(0);
    expect(await ctx.db.select().from(srsCards)).toHaveLength(0);
  });
});
