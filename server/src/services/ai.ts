import type { AiLyricRequest, AiLyricResponse, Lyrics } from '@lyrika/shared';
import { splitWords, transliterate } from '../lib/transliterate.js';

const NOTICE =
  'Черновик собран локально без модели распознавания. Подключите транскрипцию, ' +
  'чтобы получить реальную разметку по времени.';

/**
 * Placeholder for the lyric assistant. No transcription model is configured in
 * this build; the route exists so the UI's "нет текста → создать" path is real
 * end to end, and every response it returns is flagged as a simulated draft.
 */
export function draftLyrics(request: AiLyricRequest, durationSec: number): AiLyricResponse {
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
        translation: request.withTranslation ? '' : '',
        words: words.map((w, wi) => ({
          text: w.text,
          translit: request.withTranslit ? transliterate(w.text) : '',
          offset: (span * wi) / Math.max(words.length, 1),
        })),
      };
    }),
  };

  return { lyrics, simulated: true, notice: NOTICE };
}
