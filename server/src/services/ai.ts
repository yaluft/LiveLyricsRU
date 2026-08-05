import type { AiLyricRequest, AiLyricResponse, Lyrics } from '@lyrika/shared';
import { splitWords, transliterate } from '../lib/transliterate.js';
import { config } from '../config.js';
import { generateLyrics, geminiAvailable, type GeneratedLine } from './gemini.js';

const SIM_NOTICE =
  'Черновик собран локально без модели. Задайте GEMINI_API_KEY, чтобы включить ИИ-ассистента.';
const AI_NOTICE =
  'Сгенерировано ИИ (Gemini). Текст и тайминги ориентировочны — модель может ошибаться, проверьте вручную.';

/** Spreads generated lines evenly across the track and adds reading aids. */
function buildLyrics(
  trackId: string,
  generated: GeneratedLine[],
  durationSec: number,
  request: AiLyricRequest,
): Lyrics {
  const span = Math.max(durationSec, 60) / generated.length;
  return {
    trackId,
    kind: 'draft',
    source: 'ai',
    sourceLabel: 'ИИ-текст (Gemini)',
    lines: generated.map((line, i) => {
      const words = splitWords(line.text);
      return {
        id: `l${i}`,
        time: i * span,
        end: (i + 1) * span,
        text: line.text,
        translit: request.withTranslit ? transliterate(line.text) : '',
        translation: request.withTranslation ? line.translation : '',
        words: words.map((w, wi) => ({
          text: w.text,
          translit: request.withTranslit ? transliterate(w.text) : '',
          offset: (span * wi) / Math.max(words.length, 1),
        })),
      };
    }),
  };
}

/** The offline placeholder, used when no model is configured or the call fails. */
function stubResponse(request: AiLyricRequest, durationSec: number): AiLyricResponse {
  const stub = [
    'Черновик текста ещё не расшифрован',
    'Здесь появятся строки песни',
    'С разметкой по времени и переводом',
    'Отредактируйте строки вручную или подключите модель',
  ];
  const span = Math.max(durationSec, 60) / stub.length;

  const lyrics: Lyrics = {
    trackId: request.trackId ?? `ai:${request.query}`,
    kind: 'draft',
    source: 'ai',
    sourceLabel: 'ИИ-черновик (симуляция)',
    lines: stub.map((text, i) => {
      const words = splitWords(text);
      return {
        id: `l${i}`,
        time: i * span,
        end: (i + 1) * span,
        text,
        translit: request.withTranslit ? transliterate(text) : '',
        translation: '',
        words: words.map((w, wi) => ({
          text: w.text,
          translit: request.withTranslit ? transliterate(w.text) : '',
          offset: (span * wi) / Math.max(words.length, 1),
        })),
      };
    }),
  };

  return { lyrics, simulated: true, notice: SIM_NOTICE };
}

/**
 * Lyric assistant. With GEMINI_API_KEY set, asks Gemini for the song's lyrics
 * (and an inline translation) for the query, then spreads them across the
 * track. Without a key — or if the model returns nothing usable — it degrades
 * to the local placeholder draft, so the "нет текста → создать" path stays real
 * end to end in every environment.
 */
export async function draftLyrics(
  request: AiLyricRequest,
  durationSec: number,
): Promise<AiLyricResponse> {
  if (geminiAvailable()) {
    try {
      const generated = await generateLyrics(request.query, config.translateTargetLang);
      if (generated && generated.length) {
        return {
          lyrics: buildLyrics(
            request.trackId ?? `ai:${request.query}`,
            generated,
            durationSec,
            request,
          ),
          simulated: false,
          notice: AI_NOTICE,
        };
      }
    } catch {
      // Fall through to the local placeholder below.
    }
  }
  return stubResponse(request, durationSec);
}
