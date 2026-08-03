import { and, asc, eq, lte } from 'drizzle-orm';
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type State } from 'ts-fsrs';
import { normaliseWord } from '@lyrika/core';
import type { Db } from '../db/index.js';
import { srsCards, srsReviews, vocabEntries } from '../db/schema.js';

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

/** The four grades a reviewer can give. `Manual` (0) is not a review outcome. */
export const RATINGS = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;
export type ReviewRating = (typeof RATINGS)[number];

export function isReviewRating(value: number): value is ReviewRating {
  return RATINGS.includes(value as ReviewRating);
}

type CardRow = typeof srsCards.$inferSelect;

function toCard(row: CardRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    reps: row.reps,
    lapses: row.lapses,
    learning_steps: row.learningSteps,
    state: row.state as State,
    // `Card.last_review` is optional but not `| undefined` under
    // exactOptionalPropertyTypes, so a never-reviewed card omits the key
    // entirely rather than setting it to undefined.
    ...(row.lastReview === null ? {} : { last_review: new Date(row.lastReview) }),
  };
}

function fromCard(card: Card) {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learningSteps: card.learning_steps,
    state: card.state as number,
    lastReview: card.last_review ? card.last_review.getTime() : null,
  };
}

export interface SaveWordInput {
  lemma: string;
  surfaceForm: string;
  trackId?: string | null;
  lineId?: number | null;
  note?: string | null;
}

/**
 * Saves a word and gives it a review card.
 *
 * v2 had a "Учить N" button with no handler behind it — saved vocabulary was a
 * dead list. Creating the card at save time is what makes the list a queue.
 */
export async function saveWord(db: Db, input: SaveWordInput) {
  const lemma = normaliseWord(input.lemma) || input.lemma.trim();
  const now = Date.now();

  const [entry] = await db
    .insert(vocabEntries)
    .values({
      lemma,
      surfaceForm: input.surfaceForm,
      trackId: input.trackId ?? null,
      lineId: input.lineId ?? null,
      note: input.note ?? null,
      addedAt: now,
    })
    .onConflictDoUpdate({
      target: vocabEntries.lemma,
      // Re-saving from a different song updates where it was last seen rather
      // than creating a duplicate — the same word met again is one thing to
      // learn, not two.
      set: { surfaceForm: input.surfaceForm, trackId: input.trackId ?? null },
    })
    .returning();

  const created = createEmptyCard(new Date(now));
  await db
    .insert(srsCards)
    .values({ vocabEntryId: entry!.id, ...fromCard(created) })
    .onConflictDoNothing();

  return entry!;
}

export async function removeWord(db: Db, id: number): Promise<void> {
  await db.delete(vocabEntries).where(eq(vocabEntries.id, id));
}

export async function listVocabulary(db: Db) {
  return db
    .select({
      id: vocabEntries.id,
      lemma: vocabEntries.lemma,
      surfaceForm: vocabEntries.surfaceForm,
      trackId: vocabEntries.trackId,
      note: vocabEntries.note,
      addedAt: vocabEntries.addedAt,
      due: srsCards.due,
      reps: srsCards.reps,
      lapses: srsCards.lapses,
      state: srsCards.state,
    })
    .from(vocabEntries)
    .leftJoin(srsCards, eq(srsCards.vocabEntryId, vocabEntries.id))
    .orderBy(asc(vocabEntries.addedAt));
}

/** Cards due now, soonest first. */
export async function dueCards(db: Db, limit = 20, now = Date.now()) {
  return db
    .select({
      cardId: srsCards.id,
      entryId: vocabEntries.id,
      lemma: vocabEntries.lemma,
      surfaceForm: vocabEntries.surfaceForm,
      trackId: vocabEntries.trackId,
      due: srsCards.due,
      state: srsCards.state,
    })
    .from(srsCards)
    .innerJoin(vocabEntries, eq(vocabEntries.id, srsCards.vocabEntryId))
    .where(lte(srsCards.due, now))
    .orderBy(asc(srsCards.due))
    .limit(limit);
}

export interface ReviewResult {
  cardId: number;
  due: number;
  scheduledDays: number;
  state: number;
}

/**
 * Grades a card and reschedules it.
 *
 * The review is also appended to `srs_reviews`, which is never updated or
 * deleted. Keeping the full history means FSRS parameters can be re-optimised
 * against this user's actual performance later and the entire schedule
 * recomputed — impossible if only the current card state survives.
 */
export async function reviewCard(
  db: Db,
  cardId: number,
  rating: ReviewRating,
  durationMs?: number,
): Promise<ReviewResult | null> {
  const [row] = await db.select().from(srsCards).where(eq(srsCards.id, cardId)).limit(1);
  if (!row) return null;

  const now = new Date();
  const next = scheduler.next(toCard(row), now, rating).card;
  const values = fromCard(next);

  await db.update(srsCards).set(values).where(eq(srsCards.id, cardId));
  await db.insert(srsReviews).values({
    cardId,
    rating,
    reviewedAt: now.getTime(),
    durationMs: durationMs ?? null,
  });

  return {
    cardId,
    due: values.due,
    scheduledDays: values.scheduledDays,
    state: values.state,
  };
}

/** Cards due today, for the queue badge. */
export async function dueCount(db: Db, now = Date.now()): Promise<number> {
  const rows = await db
    .select({ id: srsCards.id })
    .from(srsCards)
    .where(and(lte(srsCards.due, now)));
  return rows.length;
}
