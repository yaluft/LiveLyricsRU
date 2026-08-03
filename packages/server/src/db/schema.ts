import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Epoch milliseconds. Stored as integers so SQLite can index and compare them. */
const timestamp = (name: string) => integer(name, { mode: 'number' });

export const tracks = sqliteTable('tracks', {
  /** `provider:providerId` — see `@lyrika/core`'s `trackId`. */
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  providerId: text('provider_id').notNull(),
  title: text('title').notNull(),
  artist: text('artist').notNull().default(''),
  album: text('album'),
  durationSec: integer('duration_sec').notNull().default(0),
  thumbUrl: text('thumb_url'),
  createdAt: timestamp('created_at').notNull(),
});

/**
 * The permanent lyric cache. `timingKind` records what the source actually
 * provided and is never overwritten with something we derived — a `'line'`
 * document keeps null word timings rather than gaining invented ones.
 */
export const lyrics = sqliteTable(
  'lyrics',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    trackId: text('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    sourceId: text('source_id').notNull(),
    kind: text('kind', { enum: ['synced', 'plain'] }).notNull(),
    timingKind: text('timing_kind', { enum: ['word', 'line', 'none'] }).notNull(),
    /** The untouched source body, so a parser fix can re-derive without refetching. */
    raw: text('raw').notNull(),
    fetchedAt: timestamp('fetched_at').notNull(),
  },
  (table) => [uniqueIndex('lyrics_track_source_idx').on(table.trackId, table.sourceId)],
);

export const lyricLines = sqliteTable(
  'lyric_lines',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    lyricsId: integer('lyrics_id')
      .notNull()
      .references(() => lyrics.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    startMs: integer('start_ms'),
    endMs: integer('end_ms'),
    text: text('text').notNull(),
    romanised: text('romanised').notNull(),
  },
  (table) => [uniqueIndex('lyric_lines_lyrics_idx').on(table.lyricsId, table.idx)],
);

export const lyricWords = sqliteTable(
  'lyric_words',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    lineId: integer('line_id')
      .notNull()
      .references(() => lyricLines.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    /** Null unless the source carried word timing. Never backfilled. */
    startMs: integer('start_ms'),
    endMs: integer('end_ms'),
    text: text('text').notNull(),
    romanised: text('romanised').notNull(),
  },
  (table) => [uniqueIndex('lyric_words_line_idx').on(table.lineId, table.idx)],
);

/**
 * Keyed by a hash of the line text rather than by line id, so a chorus is
 * translated once and every repeat — in this track or any other — is free.
 */
export const translations = sqliteTable(
  'translations',
  {
    lineHash: text('line_hash').notNull(),
    targetLang: text('target_lang').notNull(),
    text: text('text').notNull(),
    model: text('model').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.lineHash, table.targetLang] })],
);

export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  durationSec: integer('duration_sec').notNull().default(0),
  sha256: text('sha256').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

export const vocabEntries = sqliteTable(
  'vocab_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    lemma: text('lemma').notNull(),
    surfaceForm: text('surface_form').notNull(),
    trackId: text('track_id').references(() => tracks.id, { onDelete: 'set null' }),
    lineId: integer('line_id').references(() => lyricLines.id, { onDelete: 'set null' }),
    note: text('note'),
    addedAt: timestamp('added_at').notNull(),
  },
  (table) => [uniqueIndex('vocab_lemma_idx').on(table.lemma)],
);

/** FSRS card state. One card per vocabulary entry. */
export const srsCards = sqliteTable(
  'srs_cards',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    vocabEntryId: integer('vocab_entry_id')
      .notNull()
      .references(() => vocabEntries.id, { onDelete: 'cascade' }),
    due: timestamp('due').notNull(),
    stability: real('stability').notNull().default(0),
    difficulty: real('difficulty').notNull().default(0),
    elapsedDays: real('elapsed_days').notNull().default(0),
    scheduledDays: real('scheduled_days').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    state: integer('state').notNull().default(0),
    lastReview: timestamp('last_review'),
  },
  (table) => [uniqueIndex('srs_cards_entry_idx').on(table.vocabEntryId), index('srs_cards_due_idx').on(table.due)],
);

/**
 * Append-only review log. FSRS parameters can be re-optimised later and the
 * entire schedule recomputed from this, which is impossible if only the current
 * card state is kept.
 */
export const srsReviews = sqliteTable(
  'srs_reviews',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cardId: integer('card_id')
      .notNull()
      .references(() => srsCards.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    reviewedAt: timestamp('reviewed_at').notNull(),
    durationMs: integer('duration_ms'),
  },
  (table) => [index('srs_reviews_card_idx').on(table.cardId)],
);

/** Server-side settings. UI preferences stay in the browser's localStorage. */
export const kv = sqliteTable('kv', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
