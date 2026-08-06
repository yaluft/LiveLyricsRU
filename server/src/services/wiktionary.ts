import { config } from '../config.js';
import type { WordSense } from './gemini.js';

/**
 * Keyless word-definition fallback backed by the Wiktionary REST API. Used when a
 * tapped word isn't in the bundled glossary and Gemini isn't configured, so
 * definitions still work with no API key at all. Returns a single concise sense,
 * or null on any failure — the caller then falls back to a transliteration-only
 * card. The parsing is a pure exported function so it can be tested offline.
 */
interface WiktionaryDefinition {
  definition?: string;
  parsedExamples?: unknown;
}
interface WiktionaryPos {
  partOfSpeech?: string;
  language?: string;
  definitions?: WiktionaryDefinition[];
}

/** Strips HTML/wiki markup from a definition and trims it to one short line. */
function cleanDefinition(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Keep only the first sense up to a sentence break, capped so the card stays small.
  const firstSentence = text.split(/(?<=[.;])\s/)[0] ?? text;
  return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}…` : firstSentence;
}

/**
 * Picks the Russian section's first usable definition out of a Wiktionary
 * definition response (shape: `{ "ru": [ { partOfSpeech, definitions:[…] } ] }`).
 */
export function parseWiktionary(json: unknown, word: string): WordSense | null {
  if (!json || typeof json !== 'object') return null;
  const ru = (json as Record<string, unknown>)['ru'];
  if (!Array.isArray(ru)) return null;

  for (const raw of ru as WiktionaryPos[]) {
    const defs = raw.definitions;
    if (!Array.isArray(defs)) continue;
    for (const def of defs) {
      const cleaned = typeof def.definition === 'string' ? cleanDefinition(def.definition) : '';
      if (cleaned) {
        return {
          lemma: word.toLowerCase(),
          partOfSpeech: typeof raw.partOfSpeech === 'string' ? raw.partOfSpeech : '',
          gloss: cleaned,
          note: 'Wiktionary',
        };
      }
    }
  }
  return null;
}

export function wiktionaryEnabled(): boolean {
  return config.wiktionaryEnabled;
}

export async function defineWord(word: string): Promise<WordSense | null> {
  if (!config.wiktionaryEnabled) return null;
  const url = new URL(
    `/api/rest_v1/page/definition/${encodeURIComponent(word.toLowerCase())}`,
    config.wiktionaryBaseUrl,
  );
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(config.wiktionaryTimeoutMs),
      headers: {
        'User-Agent': 'Lyrika/2.0 (https://github.com/yaluft/LiveLyricsRU)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    return parseWiktionary(await res.json(), word);
  } catch {
    return null;
  }
}
