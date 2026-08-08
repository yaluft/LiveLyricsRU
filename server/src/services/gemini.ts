import { config } from '../config.js';

/**
 * Thin client for the Google Gemini REST API (free tier). Two capabilities are
 * exposed: batch line translation and lyric generation for the assistant.
 *
 * Everything here treats a missing API key as normal — `geminiAvailable()`
 * gates the network calls, and callers fall back to their previous behaviour
 * when it returns false. The parsing helpers are pure and exported so the
 * fragile "did the model return what we asked for" logic can be unit-tested
 * without a key or a network.
 */

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  zh: 'Chinese',
};

function langName(code: string): string {
  return LANG_NAMES[code] ?? code;
}

export function geminiAvailable(): boolean {
  return config.geminiApiKey.length > 0;
}

/** Sends one prompt and returns the concatenated text, or null when empty. */
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generate(
  prompt: string,
  opts: { json?: boolean; temperature?: number } = {},
): Promise<string | null> {
  if (!geminiAvailable()) return null;

  const url = new URL(
    `/v1beta/models/${config.geminiModel}:generateContent`,
    config.geminiBaseUrl,
  );
  url.searchParams.set('key', config.geminiApiKey);

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const maxAttempts = 3;
  let attempt = 0;
  while (true) {
    attempt += 1;
    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(config.geminiTimeoutMs),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = (await res.json()) as GeminiResponse;
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('');
      return text.trim() ? text : null;
    }

    // Rate-limited — retry with exponential backoff up to maxAttempts.
    if (res.status === 429 && attempt < maxAttempts) {
      const backoffMs = 500 * Math.pow(2, attempt - 1);
      await sleep(backoffMs);
      continue;
    }

    throw new Error(`Gemini ${res.status}`);
  }
}

/**
 * Pulls a JSON value out of a model reply. Even with responseMimeType set,
 * replies occasionally arrive fenced in ```json or wrapped in a sentence, so
 * we slice to the outermost bracket pair before parsing.
 */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new SyntaxError('no JSON found in reply');
  const open = candidate[start];
  const close = open === '[' ? ']' : '}';
  const end = candidate.lastIndexOf(close);
  if (end <= start) throw new SyntaxError('unterminated JSON in reply');
  return JSON.parse(candidate.slice(start, end + 1));
}

function asStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.map(coerceLine);
  if (value && typeof value === 'object') {
    const inner = (value as { lines?: unknown; translations?: unknown }).lines
      ?? (value as { translations?: unknown }).translations;
    if (Array.isArray(inner)) return inner.map(coerceLine);
  }
  return null;
}

/** A translation item may come back as a bare string or `{ translation | text }`. */
function coerceLine(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as { translation?: unknown; text?: unknown };
    if (typeof obj.translation === 'string') return obj.translation;
    if (typeof obj.text === 'string') return obj.text;
  }
  return '';
}

/**
 * Parses a translation reply into an array aligned 1:1 with the request. A
 * length mismatch means the lines can no longer be trusted to pair up, so the
 * whole batch is discarded (null) rather than silently mispaired.
 */
export function parseTranslations(raw: string, expected: number): string[] | null {
  let value: unknown;
  try {
    value = extractJson(raw);
  } catch {
    return null;
  }
  const arr = asStringArray(value);
  if (!arr || arr.length !== expected) return null;
  return arr.map((s) => s.trim());
}

export interface GeneratedLine {
  text: string;
  translation: string;
}

/** Parses a lyric-generation reply into original/translation pairs. */
export function parseGeneratedLines(raw: string): GeneratedLine[] | null {
  let value: unknown;
  try {
    value = extractJson(raw);
  } catch {
    return null;
  }
  const arr = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { lines?: unknown }).lines)
      ? (value as { lines: unknown[] }).lines
      : null;
  if (!arr) return null;

  const out: GeneratedLine[] = [];
  for (const item of arr) {
    if (typeof item === 'string') {
      const text = item.trim();
      if (text) out.push({ text, translation: '' });
      continue;
    }
    if (item && typeof item === 'object') {
      const obj = item as { text?: unknown; translation?: unknown };
      const text = typeof obj.text === 'string' ? obj.text.trim() : '';
      if (text) {
        out.push({
          text,
          translation: typeof obj.translation === 'string' ? obj.translation.trim() : '',
        });
      }
    }
  }
  return out.length ? out : null;
}

/**
 * Translates lines Russian → targetLang in a single request. Returns null on
 * any failure (no key, network error, unparseable or misaligned reply) so the
 * caller keeps the untranslated text rather than blocking on it.
 */
export async function translateBatch(
  lines: string[],
  targetLang: string,
): Promise<string[] | null> {
  if (!lines.length) return [];
  const numbered = lines.map((line, i) => `${i + 1}. ${line}`).join('\n');
  const prompt =
    `Translate each numbered line of these Russian song lyrics into ${langName(targetLang)}. ` +
    `Translate naturally, exactly one output line per input line, keeping the original order. ` +
    `Return ONLY a JSON array of ${lines.length} strings — no numbering, no keys, no commentary.\n\n` +
    numbered;

  const raw = await generate(prompt, { json: true, temperature: 0.2 });
  if (raw === null) return null;
  return parseTranslations(raw, lines.length);
}

/**
 * Asks the model for a song's lyrics with an inline translation. Best-effort:
 * the model may not know the song or may paraphrase, which is why the response
 * is surfaced to the user with a caution rather than as an authoritative source.
 */
export interface WordSense {
  lemma: string;
  partOfSpeech: string;
  gloss: string;
  note?: string;
}

/** Parses a single-word definition reply into a WordSense, or null. */
export function parseWordSense(raw: string): WordSense | null {
  let value: unknown;
  try {
    value = extractJson(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as { lemma?: unknown; partOfSpeech?: unknown; gloss?: unknown; note?: unknown };
  const gloss = typeof obj.gloss === 'string' ? obj.gloss.trim() : '';
  if (!gloss) return null;
  return {
    lemma: typeof obj.lemma === 'string' && obj.lemma.trim() ? obj.lemma.trim() : '',
    partOfSpeech: typeof obj.partOfSpeech === 'string' ? obj.partOfSpeech.trim() : '',
    gloss,
    ...(typeof obj.note === 'string' && obj.note.trim() ? { note: obj.note.trim() } : {}),
  };
}

/** Defines a single Russian word for a learner. Null on no key / failure. */
export async function defineWord(word: string, targetLang: string): Promise<WordSense | null> {
  const lang = langName(targetLang);
  const prompt =
    `Define the Russian word "${word}" for a ${lang}-speaking learner. ` +
    `Return ONLY JSON: {"lemma": "<dictionary form in Russian>", ` +
    `"partOfSpeech": "<part of speech in ${lang}>", ` +
    `"gloss": "<short ${lang} meaning, a few words>", ` +
    `"note": "<optional one-line usage note, or omit>"}. No commentary.`;

  const raw = await generate(prompt, { json: true, temperature: 0.2 });
  if (raw === null) return null;
  return parseWordSense(raw);
}

export async function generateLyrics(
  query: string,
  targetLang: string,
): Promise<GeneratedLine[] | null> {
  const prompt =
    `You are a Russian-lyrics assistant. Provide the lyrics for the song "${query}". ` +
    `Return ONLY a JSON array; each element is ` +
    `{"text": "<one line of the original Russian lyrics>", "translation": "<its ${langName(targetLang)} translation>"}. ` +
    `One array element per lyric line, in order. No timestamps, no section headers, no commentary.`;

  const raw = await generate(prompt, { json: true, temperature: 0.3 });
  if (raw === null) return null;
  return parseGeneratedLines(raw);
}

export interface LrcLine {
  timestamp: string; // MM:SS.cc
  original: string;
}

/**
 * Parses a generateLrc reply into timestamp/original pairs, or null on any
 * shape mismatch. Only the original line, one per timestamp: transliteration is
 * already computed locally by `transliterate()` for Cyrillic text, and
 * translation is already filled in for any saved lyrics by `translateLyrics()`.
 * Asking the model for those too and stuffing them into extra
 * same-timestamp LRC lines used to corrupt playback — `parseLrc`/`toLyricLines`
 * have no concept of an aside line, so each one became a real zero-duration
 * lyric line, shouldering the actual lyric off screen the instant playback
 * reached that timestamp.
 */
export function parseLrcLines(raw: string): LrcLine[] | null {
  let value: unknown;
  try {
    value = extractJson(raw);
  } catch {
    return null;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const linesRaw = (value as { lines?: unknown }).lines;
  if (!Array.isArray(linesRaw)) return null;

  const outLines: LrcLine[] = [];
  for (const item of linesRaw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const ts = typeof obj.timestamp === 'string' ? obj.timestamp.trim() : '';
    const original = typeof obj.original === 'string' ? obj.original.trim() : '';
    if (!ts || !original) continue;
    outLines.push({ timestamp: ts, original });
  }
  return outLines.length ? outLines : null;
}

/**
 * Ask Gemini for a timestamped LRC-like JSON payload and format it into an LRC string.
 * Returns null on any failure so callers can fall back.
 */
export async function generateLrc(
  song: string,
  artist = '',
  durationSec = 240,
): Promise<string | null> {
  const header = `Generate a synchronized LRC-style JSON for the song named "${song}"` +
    (artist ? ` by "${artist}"` : '') +
    `. Return ONLY a JSON object with a single key "lines" that is an array of objects.` +
    ` Each object must have exactly these keys: "timestamp" (format "MM:SS.xx") and` +
    ` "original" (one line of the original lyric text, in its original script).` +
    ` Ensure timestamps are plausible within the song duration (${Math.round(durationSec)} seconds)` +
    ` and strictly increasing. Return strictly valid JSON and nothing else.`;

  const prompt = header + '\n\nProvide the JSON object now.';

  const raw = await generate(prompt, { json: true, temperature: 0.2 });
  if (raw === null) return null;

  const outLines = parseLrcLines(raw);
  if (!outLines) return null;

  const lrc: string[] = [];
  lrc.push(`[ti:${song}]`);
  lrc.push(artist ? `[ar:${artist}]` : `[ar:Unknown]`);
  lrc.push('[by:Gemini LRC Generator]');
  lrc.push('');

  for (const ln of outLines) {
    lrc.push(`[${ln.timestamp}] ${ln.original}`);
  }

  return lrc.join('\n');
}
