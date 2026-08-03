import { existsSync } from 'node:fs';
import { createClient, type Client } from '@libsql/client';
import { normaliseWord, romanise } from '@lyrika/core';
import { config } from '../config.js';

export interface Sense {
  pos: string;
  gloss: string;
  note?: string;
}

export interface WordDefinition {
  word: string;
  romanised: string;
  /** The dictionary form, when one was found — `гаснет` → `гаснуть`. */
  lemma: string | null;
  senses: Sense[];
  /** False when only the romanisation could be produced. */
  found: boolean;
}

let client: Client | null = null;

/**
 * The dictionary is a separate, read-only database built offline by
 * `tools/build-dictionary`. Keeping it out of the main file means it can be
 * rebuilt or swapped without touching user data, and — because the source
 * corpora are CC BY-SA rather than MIT — shipped as its own artefact rather
 * than vendored into this repository.
 */
function open(): Client | null {
  if (client) return client;

  // Absence is deliberately NOT memoised. The dictionary is built by a separate
  // offline command, and caching "missing" forever would mean building it while
  // the server runs had no effect until a restart — a genuinely confusing
  // outcome for a step the README tells you to run. existsSync is cheap.
  if (!existsSync(config.dictionaryPath)) return null;

  try {
    client = createClient({ url: `file:${config.dictionaryPath}` });
  } catch {
    return null;
  }
  return client;
}

export function dictionaryAvailable(): boolean {
  return open() !== null;
}

export function resetDictionary(): void {
  client?.close();
  client = null;
}

/**
 * Looks a surface form up through its lemma.
 *
 * Always answers. A miss — or no dictionary at all — still returns the
 * romanisation, because the pronunciation is useful on its own and an empty
 * card reads like a bug. `found` says which happened.
 */
export async function define(word: string): Promise<WordDefinition> {
  const key = normaliseWord(word);
  const base: WordDefinition = {
    word,
    romanised: romanise(word),
    lemma: null,
    senses: [],
    found: false,
  };

  if (!key) return base;

  const db = open();
  if (!db) return base;

  try {
    const result = await db.execute({
      sql: `SELECT l.lemma AS lemma, s.pos AS pos, s.gloss AS gloss, s.note AS note
              FROM forms f
              JOIN lemmas l ON l.id = f.lemma_id
              JOIN senses s ON s.lemma_id = l.id
             WHERE f.form = ?
             ORDER BY s.idx
             LIMIT 12`,
      args: [key],
    });

    if (result.rows.length === 0) return base;

    return {
      ...base,
      lemma: String(result.rows[0]!.lemma),
      found: true,
      senses: result.rows.map((row) => ({
        pos: String(row.pos ?? ''),
        gloss: String(row.gloss ?? ''),
        ...(row.note ? { note: String(row.note) } : {}),
      })),
    };
  } catch {
    return base;
  }
}
