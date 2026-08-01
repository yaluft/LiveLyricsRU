import type { LyricLine, Lyrics, Track } from '@lyrika/shared';
import { splitWords, transliterate } from '../lib/transliterate.js';

/**
 * The demo catalogue. Titles and artists are real; every lyric line below is
 * original demo text written for this project, not the published lyrics of the
 * song it is attached to — the app never ships copyrighted lyrics of its own,
 * it fetches them from the configured sources at runtime.
 */

interface RawLine {
  time: number;
  end: number;
  text: string;
  translation: string;
}

function buildLines(raw: RawLine[]): LyricLine[] {
  return raw.map((line, i) => {
    const words = splitWords(line.text);
    const span = Math.max(line.end - line.time, 0.6);
    return {
      id: `l${i}`,
      time: line.time,
      end: line.end,
      text: line.text,
      translit: transliterate(line.text),
      translation: line.translation,
      words: words.map((w, wi) => ({
        text: w.text,
        translit: transliterate(w.text),
        offset: words.length > 1 ? (span * wi) / words.length : 0,
      })),
    };
  });
}

const NEBO_LINES: RawLine[] = [
  { time: 0, end: 6, text: 'Ночь опускается на город', translation: 'Night settles over the city' },
  { time: 6, end: 12, text: 'Хочешь, я спою тебе', translation: 'If you want, I will sing to you' },
  { time: 12, end: 18, text: 'Тихую песню про небо', translation: 'A quiet song about the sky' },
  { time: 18, end: 25, text: 'Где свет никогда не гаснет', translation: 'Where the light never goes out' },
  { time: 25, end: 31, text: 'И ветер носит имя твоё', translation: 'And the wind carries your name' },
  { time: 31, end: 37, text: 'Мы будем помнить это лето', translation: 'We will remember this summer' },
  { time: 37, end: 44, text: 'Небо в глазах твоих', translation: 'The sky in your eyes' },
  { time: 44, end: 50, text: 'Я не умею прощаться', translation: 'I do not know how to say goodbye' },
  { time: 50, end: 57, text: 'Каждое слово как море', translation: 'Every word is like the sea' },
  { time: 57, end: 63, text: 'Волны считают года', translation: 'The waves are counting the years' },
  { time: 63, end: 70, text: 'Останься ещё на минуту', translation: 'Stay for one more minute' },
  { time: 70, end: 78, text: 'Пока горит этот свет', translation: 'While this light is still burning' },
];

const VYKHODA_LINES: RawLine[] = [
  { time: 0, end: 7, text: 'Дождь стучится в окна', translation: 'Rain knocks at the windows' },
  { time: 7, end: 14, text: 'Город спит без меня', translation: 'The city sleeps without me' },
  { time: 14, end: 21, text: 'Выхода нет из этой зимы', translation: 'There is no way out of this winter' },
  { time: 21, end: 28, text: 'Только твои огни', translation: 'Only your lights remain' },
  { time: 28, end: 35, text: 'Утро придёт как обещание', translation: 'Morning will come like a promise' },
  { time: 35, end: 42, text: 'Мы разожжём костры', translation: 'We will light the fires' },
];

const GRUPPA_LINES: RawLine[] = [
  { time: 0, end: 8, text: 'Тёплое место, но улицы ждут', translation: 'A warm place, but the streets are waiting' },
  { time: 8, end: 15, text: 'Звёзды над крышами', translation: 'Stars above the rooftops' },
  { time: 15, end: 22, text: 'Я остаюсь на этой земле', translation: 'I am staying on this earth' },
  { time: 22, end: 30, text: 'Пожелай мне удачи в бою', translation: 'Wish me luck in the battle' },
];

interface CatalogEntry {
  track: Track;
  lines: RawLine[] | null;
}

const ENTRIES: CatalogEntry[] = [
  {
    track: {
      id: 'demo-nebo-v-glazakh',
      title: 'Небо в глазах',
      artist: 'Земфира',
      album: 'Прости меня моя любовь',
      durationSec: 221,
      provider: 'demo',
      providerId: 'demo-nebo-v-glazakh',
      hasSyncedLyrics: true,
    },
    lines: NEBO_LINES,
  },
  {
    track: {
      id: 'demo-iskala',
      title: 'Искала',
      artist: 'Земфира',
      album: 'Вендетта',
      durationSec: 252,
      provider: 'demo',
      providerId: 'demo-iskala',
      hasSyncedLyrics: true,
    },
    lines: NEBO_LINES,
  },
  {
    track: {
      id: 'demo-khochesh',
      title: 'Хочешь?',
      artist: 'Земфира',
      album: 'Прости меня моя любовь',
      durationSec: 213,
      provider: 'demo',
      providerId: 'demo-khochesh',
      hasSyncedLyrics: true,
    },
    lines: NEBO_LINES,
  },
  {
    track: {
      id: 'demo-do-svidanya',
      title: 'До свиданья',
      artist: 'Земфира',
      durationSec: 238,
      provider: 'demo',
      providerId: 'demo-do-svidanya',
      hasSyncedLyrics: false,
    },
    lines: null,
  },
  {
    track: {
      id: 'demo-progulka',
      title: 'Прогулка',
      artist: 'Земфира',
      durationSec: 284,
      provider: 'demo',
      providerId: 'demo-progulka',
      hasSyncedLyrics: true,
    },
    lines: NEBO_LINES,
  },
  {
    track: {
      id: 'demo-macho',
      title: 'Мачо',
      artist: 'Земфира',
      durationSec: 192,
      provider: 'demo',
      providerId: 'demo-macho',
      hasSyncedLyrics: false,
    },
    lines: null,
  },
  {
    track: {
      id: 'demo-vykhoda-net',
      title: 'Выхода нет',
      artist: 'Сплин',
      album: 'Гранатовый альбом',
      durationSec: 245,
      provider: 'demo',
      providerId: 'demo-vykhoda-net',
      hasSyncedLyrics: true,
    },
    lines: VYKHODA_LINES,
  },
  {
    track: {
      id: 'demo-romans',
      title: 'Романс',
      artist: 'Сплин',
      durationSec: 268,
      provider: 'demo',
      providerId: 'demo-romans',
      hasSyncedLyrics: true,
    },
    lines: VYKHODA_LINES,
  },
  {
    track: {
      id: 'demo-gruppa-krovi',
      title: 'Группа крови',
      artist: 'Кино',
      album: 'Группа крови',
      durationSec: 286,
      provider: 'demo',
      providerId: 'demo-gruppa-krovi',
      hasSyncedLyrics: true,
    },
    lines: GRUPPA_LINES,
  },
  {
    track: {
      id: 'demo-vladivostok',
      title: 'Владивосток 2000',
      artist: 'Мумий Тролль',
      durationSec: 234,
      provider: 'demo',
      providerId: 'demo-vladivostok',
      hasSyncedLyrics: true,
    },
    lines: GRUPPA_LINES,
  },
  {
    track: {
      id: 'demo-dykhanie',
      title: 'Дыхание',
      artist: 'Наутилус Помпилиус',
      durationSec: 271,
      provider: 'demo',
      providerId: 'demo-dykhanie',
      hasSyncedLyrics: true,
    },
    lines: VYKHODA_LINES,
  },
  {
    track: {
      id: 'demo-tem-kto-s-nami',
      title: 'Тем, кто с нами',
      artist: 'Ночные снайперы',
      durationSec: 226,
      provider: 'demo',
      providerId: 'demo-tem-kto-s-nami',
      hasSyncedLyrics: false,
    },
    lines: null,
  },
];

export const CATALOG: Track[] = ENTRIES.map((e) => e.track);

const LYRICS_BY_TRACK = new Map<string, Lyrics>(
  ENTRIES.filter((e) => e.lines !== null).map((e) => [
    e.track.id,
    {
      trackId: e.track.id,
      kind: 'synced' as const,
      source: 'lrclib' as const,
      sourceLabel: 'Демо-набор',
      lines: buildLines(e.lines as RawLine[]),
    },
  ]),
);

export function findTrack(id: string): Track | undefined {
  return CATALOG.find((t) => t.id === id);
}

export function demoLyrics(trackId: string): Lyrics | undefined {
  return LYRICS_BY_TRACK.get(trackId);
}

export function searchCatalog(query: string): Track[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG.slice(0, 8);
  const scored = CATALOG.map((track) => {
    const haystack = `${track.title} ${track.artist} ${track.album ?? ''}`.toLowerCase();
    let score = 0;
    if (haystack.includes(q)) score += 10;
    for (const term of q.split(/\s+/)) {
      if (term && haystack.includes(term)) score += 3;
    }
    return { track, score };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.length ? scored.map((s) => s.track) : CATALOG.slice(0, 6);
}
