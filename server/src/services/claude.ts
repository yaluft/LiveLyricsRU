import Anthropic, { APIError } from '@anthropic-ai/sdk';
import type { AiExplainRequest } from '@lyrika/shared';
import { config } from '../config.js';

/**
 * The only module that talks to the Anthropic SDK. Everything above it degrades
 * to a local fallback when `ANTHROPIC_API_KEY` is absent — same contract as a
 * missing yt-dlp, so the app still works end to end without a key.
 */
const MAX_TOKENS = 16_000;

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
type Effort = (typeof EFFORTS)[number];

function effort(): Effort {
  const found = EFFORTS.find((level) => level === config.anthropicEffort);
  return found ?? 'medium';
}

export class ClaudeUnavailable extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'ClaudeUnavailable';
    this.hint = hint;
  }
}

export function claudeAvailable(): boolean {
  return config.anthropicApiKey !== '';
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!claudeAvailable()) {
    throw new ClaudeUnavailable(
      'ИИ-помощник не настроен на сервере',
      'Задайте ANTHROPIC_API_KEY, чтобы включить перевод и разбор строк.',
    );
  }
  client ??= new Anthropic({
    apiKey: config.anthropicApiKey,
    timeout: config.anthropicTimeoutMs,
    maxRetries: 1,
  });
  return client;
}

interface JsonSchema {
  [key: string]: unknown;
}

/**
 * One non-streaming call with a structured-output schema, so callers get a
 * parsed object instead of hand-written JSON scraping. Never uses
 * `budget_tokens` or sampling parameters — both are rejected by the model.
 */
async function askJson<T>(system: string, user: string, schema: JsonSchema): Promise<T> {
  const anthropic = getClient();

  let response;
  try {
    response = await anthropic.messages.create({
      model: config.anthropicModel,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: effort(),
        format: { type: 'json_schema', schema },
      },
      system,
      messages: [{ role: 'user', content: user }],
    });
  } catch (error) {
    if (error instanceof APIError) {
      throw new ClaudeUnavailable(
        `Модель ответила ошибкой ${error.status ?? ''}`.trim(),
        'Попробуйте позже или отключите ИИ-функции в настройках.',
      );
    }
    throw new ClaudeUnavailable(
      'Не удалось связаться с моделью',
      'Проверьте соединение и попробуйте ещё раз.',
    );
  }

  if (response.stop_reason === 'refusal') {
    throw new ClaudeUnavailable(
      'Модель отклонила запрос',
      'Переформулируйте запрос или обойдитесь без ИИ.',
    );
  }

  let text = '';
  for (const block of response.content) {
    if (block.type === 'text') text += block.text;
  }
  if (!text.trim()) {
    throw new ClaudeUnavailable('Модель вернула пустой ответ', 'Попробуйте ещё раз.');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ClaudeUnavailable(
      'Не удалось разобрать ответ модели',
      'Попробуйте ещё раз.',
    );
  }
}

const TRANSLATION_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['translations'],
  properties: {
    translations: {
      type: 'array',
      description: 'One English translation per input line, in the same order.',
      items: { type: 'string' },
    },
  },
};

interface TranslationPayload {
  translations: string[];
}

/** Pads or truncates so callers always get one entry per input line. */
function align(values: string[], length: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < length; i += 1) out.push(values[i] ?? '');
  return out;
}

/**
 * Translates a whole track in a single call — line-by-line requests lose the
 * context that makes song lyrics readable, and cost N times as much.
 */
export async function translateLines(
  lines: string[],
  ctx: { title: string; artist: string },
): Promise<string[]> {
  if (!lines.length) return [];

  const numbered = lines.map((text, i) => `${i + 1}. ${text}`).join('\n');
  const payload = await askJson<TranslationPayload>(
    'You translate Russian song lyrics into natural, singable English. You return ' +
      'exactly one translation per input line, in the same order, never merging or ' +
      'splitting lines. Prefer the sense of the line over a word-for-word rendering, ' +
      'but never invent content that is not in the original. Return an empty string ' +
      'for a line that cannot be translated (an instrumental marker, for example).',
    `Song: "${ctx.title}" by ${ctx.artist || 'unknown artist'}.\n` +
      `Translate these ${lines.length} lines into English, one entry per line:\n\n${numbered}`,
    TRANSLATION_SCHEMA,
  );

  const translations = Array.isArray(payload.translations) ? payload.translations : [];
  return align(
    translations.map((t) => (typeof t === 'string' ? t.trim() : '')),
    lines.length,
  );
}

const DRAFT_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['lines'],
  properties: {
    lines: {
      type: 'array',
      description: 'Plain Russian lyric lines, one per array entry, without timestamps.',
      items: { type: 'string' },
    },
  },
};

interface DraftPayload {
  lines: string[];
}

/** Drafts plain Russian lyric lines; timing is derived by the caller. */
export async function draftLyricLines(query: string, durationSec: number): Promise<string[]> {
  const target = Math.min(Math.max(Math.round(Math.max(durationSec, 60) / 6), 12), 48);
  const payload = await askJson<DraftPayload>(
    'You are a lyric assistant for a Russian-language listening app. You write plain ' +
      'Russian lyric lines: no timestamps, no section headers, no numbering, no ' +
      'transliteration, no translation. One line of the song per array entry. If you ' +
      'do not know the real lyrics of the requested song, write an original draft in ' +
      'its style rather than guessing at the published text.',
    `Трек: ${query}. Длительность около ${Math.round(durationSec)} секунд. ` +
      `Дайте примерно ${target} строк текста.`,
    DRAFT_SCHEMA,
  );

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  return lines
    .map((line) => (typeof line === 'string' ? line.trim() : ''))
    .filter((line) => line.length > 0);
}

const EXPLAIN_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['meaning', 'literal', 'notes'],
  properties: {
    meaning: {
      type: 'string',
      description: 'What the line actually says once idiom and register are unwound.',
    },
    literal: {
      type: 'string',
      description: 'The literal, word-order reading — deliberately different from `meaning`.',
    },
    notes: {
      type: 'array',
      description: 'Idioms, wordplay and cultural references worth calling out.',
      items: { type: 'string' },
    },
  },
};

export interface LineExplanation {
  meaning: string;
  literal: string;
  notes: string[];
}

export async function explainLine(req: AiExplainRequest): Promise<LineExplanation> {
  const context = req.context?.length ? `\nОкружающие строки:\n${req.context.join('\n')}` : '';
  const where = [req.trackTitle, req.artist].filter(Boolean).join(' — ');

  const payload = await askJson<LineExplanation>(
    'You unpack single lines of Russian song lyrics for a learner. `meaning` explains ' +
      'what the line actually conveys — idiom unwound, register and tone named, ' +
      'cultural reference resolved. `literal` is the plain word-order reading of the ' +
      'same line, which is deliberately a different thing from `meaning`. `notes` ' +
      'lists idioms, wordplay, slang and references, one per entry, empty when the ' +
      'line is plain. Write `meaning` and `literal` in English; keep quoted Russian ' +
      'fragments in Cyrillic.',
    `Строка: ${req.text}${where ? `\nПесня: ${where}` : ''}${context}`,
    EXPLAIN_SCHEMA,
  );

  return {
    meaning: typeof payload.meaning === 'string' ? payload.meaning : '',
    literal: typeof payload.literal === 'string' ? payload.literal : '',
    notes: Array.isArray(payload.notes)
      ? payload.notes.filter((note): note is string => typeof note === 'string' && note !== '')
      : [],
  };
}
