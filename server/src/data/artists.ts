import type { ArtistProfile } from '@lyrika/shared';

/**
 * Artist metadata is sample data. No music-analytics provider is wired up in
 * this build, so every profile is flagged `estimated: true` and the UI labels
 * the figures as such rather than presenting them as measured.
 */
const PROFILES: ArtistProfile[] = [
  {
    id: 'zemfira',
    name: 'Земфира',
    origin: 'Уфа, Башкортостан',
    activeYears: '1998—',
    genres: ['рок', 'авторская песня'],
    topTracks: [
      { title: 'Искала', durationSec: 252, trackId: 'demo-iskala' },
      { title: 'Хочешь?', durationSec: 213, trackId: 'demo-khochesh' },
      { title: 'Небо в глазах', durationSec: 221, trackId: 'demo-nebo-v-glazakh' },
      { title: 'До свиданья', durationSec: 238, trackId: 'demo-do-svidanya' },
      { title: 'Прогулка', durationSec: 284, trackId: 'demo-progulka' },
      { title: 'Мачо', durationSec: 192, trackId: 'demo-macho' },
      { title: 'Ромашки', durationSec: 205 },
      { title: 'Трафик', durationSec: 231 },
      { title: 'Жить в твоей голове', durationSec: 247 },
      { title: 'Блюз', durationSec: 198 },
    ],
    topCountries: [
      { country: 'Россия', share: 1 },
      { country: 'Казахстан', share: 0.54 },
      { country: 'Беларусь', share: 0.41 },
      { country: 'Германия', share: 0.28 },
      { country: 'Израиль', share: 0.19 },
    ],
    discography: [
      { title: 'Земфира', year: 1999 },
      { title: 'Прости меня моя любовь', year: 2000 },
      { title: 'Четырнадцать недель тишины', year: 2002 },
      { title: 'Вендетта', year: 2005 },
      { title: 'Спасибо', year: 2007 },
      { title: 'Z-Sides', year: 2009 },
      { title: 'Жить в твоей голове', year: 2013 },
      { title: 'Бордерлайн', year: 2021 },
      { title: 'Красота и уродство', year: 2023 },
    ],
    estimated: true,
  },
  {
    id: 'splean',
    name: 'Сплин',
    origin: 'Санкт-Петербург',
    activeYears: '1994—',
    genres: ['рок', 'альтернатива'],
    topTracks: [
      { title: 'Выхода нет', durationSec: 245, trackId: 'demo-vykhoda-net' },
      { title: 'Романс', durationSec: 268, trackId: 'demo-romans' },
      { title: 'Линия жизни', durationSec: 254 },
      { title: 'Орбит без сахара', durationSec: 218 },
      { title: 'Мы сидели и курили', durationSec: 232 },
    ],
    topCountries: [
      { country: 'Россия', share: 1 },
      { country: 'Украина', share: 0.48 },
      { country: 'Беларусь', share: 0.39 },
      { country: 'Казахстан', share: 0.31 },
      { country: 'Латвия', share: 0.16 },
    ],
    discography: [
      { title: 'Пыльная быль', year: 1994 },
      { title: 'Коллекционер оружия', year: 1996 },
      { title: 'Гранатовый альбом', year: 1998 },
      { title: 'Альтависта', year: 1999 },
      { title: '25-й кадр', year: 2001 },
      { title: 'Реверсивная хроника событий', year: 2004 },
    ],
    estimated: true,
  },
  {
    id: 'kino',
    name: 'Кино',
    origin: 'Ленинград',
    activeYears: '1981—1990',
    genres: ['пост-панк', 'рок'],
    topTracks: [
      { title: 'Группа крови', durationSec: 286, trackId: 'demo-gruppa-krovi' },
      { title: 'Кукушка', durationSec: 372 },
      { title: 'Пачка сигарет', durationSec: 268 },
      { title: 'Звезда по имени Солнце', durationSec: 226 },
      { title: 'Перемен', durationSec: 315 },
    ],
    topCountries: [
      { country: 'Россия', share: 1 },
      { country: 'Украина', share: 0.62 },
      { country: 'Беларусь', share: 0.44 },
      { country: 'Казахстан', share: 0.37 },
      { country: 'Германия', share: 0.21 },
    ],
    discography: [
      { title: '45', year: 1982 },
      { title: 'Начальник Камчатки', year: 1984 },
      { title: 'Ночь', year: 1986 },
      { title: 'Группа крови', year: 1988 },
      { title: 'Звезда по имени Солнце', year: 1989 },
      { title: 'Чёрный альбом', year: 1990 },
    ],
    estimated: true,
  },
];

const FALLBACK_COUNTRIES = [
  { country: 'Россия', share: 1 },
  { country: 'Казахстан', share: 0.5 },
  { country: 'Беларусь', share: 0.38 },
  { country: 'Украина', share: 0.3 },
  { country: 'Германия', share: 0.18 },
];

export function findArtist(name: string): ArtistProfile {
  const q = name.trim().toLowerCase();
  const hit = PROFILES.find((p) => p.name.toLowerCase() === q || p.id === q);
  if (hit) return hit;
  return {
    id: q.replace(/\s+/g, '-') || 'unknown',
    name: name.trim() || 'Неизвестный исполнитель',
    origin: '—',
    activeYears: '—',
    genres: [],
    topTracks: [],
    topCountries: FALLBACK_COUNTRIES,
    discography: [],
    estimated: true,
  };
}
