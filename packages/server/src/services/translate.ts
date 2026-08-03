import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { config } from '../config.js';
import type { Db } from '../db/index.js';
import { translations } from '../db/schema.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/** Whole stanzas per request, so the model has context and the line count is not the request count. */
const BATCH_SIZE = 24;
const TIMEOUT_MS = 30_000;

export function lineHash(text: string): string {
  return createHash('sha256').update(text.trim().toLowerCase()).digest('hex').slice(0, 32);
}

export function translationEnabled(): boolean {
  return config.anthropicApiKey !== '';
}

async function readCache(
  db: Db,
  hashes: string[],
  targetLang: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (hashes.length === 0) return out;

  // Chunked: SQLite has a hard limit on bound parameters per statement.
  for (let i = 0; i < hashes.length; i += 400) {
    const slice = hashes.slice(i, i + 400);
    // Both halves of the primary key are in the WHERE clause, so this is an
    // index lookup rather than fetching every language and filtering in JS.
    const rows = await db
      .select()
      .from(translations)
      .where(
        and(inArray(translations.lineHash, slice), eq(translations.targetLang, targetLang)),
      );

    for (const row of rows) out.set(row.lineHash, row.text);
  }
  return out;
}

interface AnthropicResponse {
  content?: { type?: string; text?: string }[];
}

/**
 * Asks for a JSON array back, one entry per input line, so the mapping survives
 * the round trip. Lines are numbered in the prompt because a model asked to
 * translate a stanza will otherwise merge or split lines to read naturally —
 * which is good prose and useless for a line-synced view.
 */
async function translateBatch(lines: string[]): Promise<string[]> {
  const numbered = lines.map((line, i) => `${i + 1}. ${line}`).join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': API_VERSION,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.translationModel,
        max_tokens: 4096,
        system:
          'You translate Russian song lyrics into natural English for a language learner. ' +
          'Preserve the line structure exactly: one output line per input line, in order, ' +
          'even when that reads less naturally than merging them. Keep it plain and literal ' +
          'enough that the learner can map words across, without being word-for-word clumsy. ' +
          'Reply with ONLY a JSON array of strings and nothing else.',
        messages: [
          {
            role: 'user',
            content: `Translate these ${lines.length} lines into English.\n\n${numbered}`,
          },
        ],
      }),
    });

    if (!response.ok) return [];

    const body = (await response.json()) as AnthropicResponse;
    const text = body.content?.find((part) => part.type === 'text')?.text?.trim() ?? '';

    // The model was told to reply with bare JSON, but a stray fence is the most
    // common deviation and is cheap to tolerate.
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const parsed: unknown = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) return [];
    // A length mismatch means the line mapping is unreliable; discarding the
    // batch is better than silently pairing lines with the wrong translations.
    if (parsed.length !== lines.length) return [];

    return parsed.map((entry) => (typeof entry === 'string' ? entry : ''));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Translates lines, reading through a permanent cache keyed by the *text* of
 * each line rather than its position. A chorus is therefore paid for once, and
 * every later repeat — in this track or any other — is free.
 *
 * With no API key configured this returns an empty map rather than throwing,
 * and the UI hides the translation row. v2's failure mode was printing
 * "перевод недоступен" under every line of every real track, which is worse
 * than showing nothing.
 */
export async function translateLines(
  db: Db,
  lines: readonly string[],
  targetLang = 'en',
): Promise<Map<string, string>> {
  const unique = [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
  const byHash = new Map(unique.map((line) => [lineHash(line), line]));

  const cached = await readCache(db, [...byHash.keys()], targetLang);
  if (!translationEnabled()) return cached;

  const missing = [...byHash.entries()].filter(([hash]) => !cached.has(hash));
  if (missing.length === 0) return cached;

  const now = Date.now();
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    const results = await translateBatch(batch.map(([, line]) => line));
    if (results.length !== batch.length) continue;

    const rows = batch
      .map(([hash], idx) => ({
        lineHash: hash,
        targetLang,
        text: results[idx] ?? '',
        model: config.translationModel,
        createdAt: now,
      }))
      .filter((row) => row.text !== '');

    if (rows.length === 0) continue;

    await db.insert(translations).values(rows).onConflictDoNothing();
    for (const row of rows) cached.set(row.lineHash, row.text);
  }

  return cached;
}
