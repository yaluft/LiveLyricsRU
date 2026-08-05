import type { Clip } from '@lyrika/shared';

/**
 * Seed content for the shared clip feed. There is no multi-user backend in this
 * build, so these stand in for other people's posts; anything the local user
 * publishes is appended to the on-disk store and merged in ahead of these.
 */
export const SEED_CLIPS: Clip[] = [
  {
    id: 'seed-1',
    trackId: 'demo-vykhoda-net',
    trackTitle: 'Выхода нет',
    artist: 'Сплин',
    startSec: 14,
    endSec: 24,
    lineText: 'Выхода нет из этой зимы',
    translit: 'vykhoda nyet iz etoy zimy',
    translation: 'There is no way out of this winter',
    show: { translit: true, translation: true, waves: true, artwork: false },
    author: '@dasha',
    likes: 42,
    createdAt: Date.parse('2026-07-28T18:20:00Z'),
  },
  {
    id: 'seed-2',
    trackId: 'demo-gruppa-krovi',
    trackTitle: 'Группа крови',
    artist: 'Кино',
    startSec: 22,
    endSec: 32,
    lineText: 'Пожелай мне удачи в бою',
    translit: 'pozhyelay mnye udachi v boyu',
    translation: 'Wish me luck in the battle',
    show: { translit: true, translation: true, waves: false, artwork: true },
    author: '@ilya',
    likes: 118,
    createdAt: Date.parse('2026-07-29T09:05:00Z'),
  },
  {
    id: 'seed-3',
    trackId: 'demo-nebo-v-glazakh',
    trackTitle: 'Небо в глазах',
    artist: 'Земфира',
    startSec: 18,
    endSec: 28,
    lineText: 'Где свет никогда не гаснет',
    translit: 'gdye svyet nikogda nye gasnyet',
    translation: 'Where the light never goes out',
    show: { translit: true, translation: true, waves: true, artwork: false },
    author: '@marina',
    likes: 67,
    createdAt: Date.parse('2026-07-30T21:40:00Z'),
  },
];
