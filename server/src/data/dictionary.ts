import type { WordDefinition } from '@lyrika/shared';
import { normalizeWord, transliterate } from '../lib/transliterate.js';

interface Entry {
  lemma: string;
  pos: string;
  gloss: string;
  note?: string;
  /** Inflected forms that should resolve to this entry. */
  forms?: string[];
}

/**
 * A hand-built starter glossary. It is deliberately small: the point is that
 * tapping a word always resolves to *something* useful offline. Words outside
 * it fall back to a transliteration-only card.
 */
const ENTRIES: Entry[] = [
  { lemma: 'свет', pos: 'noun', gloss: 'light; daylight', note: 'also “world” in set phrases (весь свет = the whole world)', forms: ['света', 'свету', 'светом'] },
  { lemma: 'гаснуть', pos: 'verb', gloss: 'to go out, to fade', forms: ['гаснет', 'гаснут', 'гас', 'гасла'] },
  { lemma: 'небо', pos: 'noun', gloss: 'sky, heaven', forms: ['неба', 'небе', 'небом', 'небеса'] },
  { lemma: 'ветер', pos: 'noun', gloss: 'wind', forms: ['ветра', 'ветру', 'ветром', 'ветре'] },
  { lemma: 'имя', pos: 'noun', gloss: 'name', forms: ['имени', 'именем', 'имена'] },
  { lemma: 'твой', pos: 'pronoun', gloss: 'your, yours', forms: ['твоё', 'твоя', 'твои', 'твоего', 'твоей'] },
  { lemma: 'лето', pos: 'noun', gloss: 'summer', forms: ['лета', 'летом', 'лете'] },
  { lemma: 'помнить', pos: 'verb', gloss: 'to remember', forms: ['помню', 'помнит', 'помним', 'помнят'] },
  { lemma: 'носить', pos: 'verb', gloss: 'to carry, to wear', forms: ['носит', 'ношу', 'носят', 'носил'] },
  { lemma: 'песня', pos: 'noun', gloss: 'song', forms: ['песню', 'песни', 'песне', 'песен'] },
  { lemma: 'тихий', pos: 'adjective', gloss: 'quiet, soft', forms: ['тихую', 'тихая', 'тихое', 'тихо'] },
  { lemma: 'ночь', pos: 'noun', gloss: 'night', forms: ['ночи', 'ночью', 'ночей'] },
  { lemma: 'город', pos: 'noun', gloss: 'city, town', forms: ['города', 'городе', 'городом', 'городов'] },
  { lemma: 'выход', pos: 'noun', gloss: 'exit, way out', forms: ['выхода', 'выходе', 'выходу'] },
  { lemma: 'зима', pos: 'noun', gloss: 'winter', forms: ['зимы', 'зиме', 'зимой', 'зиму'] },
  { lemma: 'дождь', pos: 'noun', gloss: 'rain', forms: ['дождя', 'дожде', 'дождём'] },
  { lemma: 'окно', pos: 'noun', gloss: 'window', forms: ['окна', 'окне', 'окном', 'окнах'] },
  { lemma: 'море', pos: 'noun', gloss: 'sea', forms: ['моря', 'морю', 'морем'] },
  { lemma: 'волна', pos: 'noun', gloss: 'wave', forms: ['волны', 'волне', 'волной', 'волнам'] },
  { lemma: 'год', pos: 'noun', gloss: 'year', forms: ['года', 'году', 'годом', 'лет'] },
  { lemma: 'слово', pos: 'noun', gloss: 'word', forms: ['слова', 'слову', 'словом', 'слов'] },
  { lemma: 'глаз', pos: 'noun', gloss: 'eye', forms: ['глаза', 'глазах', 'глазами', 'глаз'] },
  { lemma: 'звезда', pos: 'noun', gloss: 'star', forms: ['звёзды', 'звезды', 'звёзд', 'звездой'] },
  { lemma: 'крыша', pos: 'noun', gloss: 'roof', forms: ['крыш', 'крышами', 'крыше'] },
  { lemma: 'земля', pos: 'noun', gloss: 'earth, land', forms: ['земле', 'земли', 'землёй'] },
  { lemma: 'удача', pos: 'noun', gloss: 'luck, fortune', forms: ['удачи', 'удаче', 'удачу'] },
  { lemma: 'бой', pos: 'noun', gloss: 'battle, fight', forms: ['бою', 'боя', 'боем'] },
  { lemma: 'огонь', pos: 'noun', gloss: 'fire, light', forms: ['огни', 'огня', 'огнём', 'огней'] },
  { lemma: 'утро', pos: 'noun', gloss: 'morning', forms: ['утра', 'утром', 'утре'] },
  { lemma: 'костёр', pos: 'noun', gloss: 'bonfire, campfire', forms: ['костры', 'костра', 'кострами'] },
  { lemma: 'минута', pos: 'noun', gloss: 'minute', forms: ['минуту', 'минуты', 'минуте'] },
  { lemma: 'место', pos: 'noun', gloss: 'place, spot', forms: ['места', 'месте', 'местом'] },
  { lemma: 'улица', pos: 'noun', gloss: 'street', forms: ['улицы', 'улице', 'улицу', 'улиц'] },
  { lemma: 'ждать', pos: 'verb', gloss: 'to wait, to expect', forms: ['ждут', 'ждёт', 'жду', 'ждал'] },
  { lemma: 'спать', pos: 'verb', gloss: 'to sleep', forms: ['спит', 'сплю', 'спят', 'спал'] },
  { lemma: 'остаться', pos: 'verb', gloss: 'to stay, to remain', forms: ['останься', 'остаюсь', 'остался', 'останется'] },
  { lemma: 'гореть', pos: 'verb', gloss: 'to burn', forms: ['горит', 'горят', 'горел'] },
  { lemma: 'считать', pos: 'verb', gloss: 'to count; to consider', forms: ['считают', 'считает', 'считал'] },
  { lemma: 'прощаться', pos: 'verb', gloss: 'to say goodbye', forms: ['прощаюсь', 'прощался'] },
  { lemma: 'уметь', pos: 'verb', gloss: 'to know how to, to be able', forms: ['умею', 'умеет', 'умеют'] },
  { lemma: 'опускаться', pos: 'verb', gloss: 'to descend, to settle', forms: ['опускается', 'опускался'] },
  { lemma: 'петь', pos: 'verb', gloss: 'to sing', forms: ['спою', 'поёт', 'пою', 'пел'] },
  { lemma: 'хотеть', pos: 'verb', gloss: 'to want', forms: ['хочешь', 'хочу', 'хотят', 'хотел'] },
  { lemma: 'приходить', pos: 'verb', gloss: 'to come, to arrive', forms: ['придёт', 'приходит', 'пришёл'] },
  { lemma: 'разжечь', pos: 'verb', gloss: 'to kindle, to light', forms: ['разожжём', 'разжёг'] },
  { lemma: 'пожелать', pos: 'verb', gloss: 'to wish', forms: ['пожелай', 'пожелаю'] },
  { lemma: 'стучаться', pos: 'verb', gloss: 'to knock', forms: ['стучится', 'стучался'] },
  { lemma: 'тёплый', pos: 'adjective', gloss: 'warm', forms: ['тёплое', 'тёплая', 'тёплым'] },
  { lemma: 'каждый', pos: 'pronoun', gloss: 'each, every', forms: ['каждое', 'каждая', 'каждым'] },
  { lemma: 'обещание', pos: 'noun', gloss: 'promise', forms: ['обещания', 'обещанием'] },
  { lemma: 'никогда', pos: 'adverb', gloss: 'never' },
  { lemma: 'где', pos: 'adverb', gloss: 'where' },
  { lemma: 'ещё', pos: 'adverb', gloss: 'still, more, yet' },
  { lemma: 'только', pos: 'particle', gloss: 'only, just' },
  { lemma: 'пока', pos: 'conjunction', gloss: 'while; for now; bye' },
  { lemma: 'этот', pos: 'pronoun', gloss: 'this', forms: ['это', 'эта', 'эти', 'этой', 'этом'] },
  { lemma: 'мы', pos: 'pronoun', gloss: 'we', forms: ['нас', 'нам', 'нами'] },
  { lemma: 'я', pos: 'pronoun', gloss: 'I', forms: ['меня', 'мне', 'мной'] },
  { lemma: 'не', pos: 'particle', gloss: 'not' },
  { lemma: 'и', pos: 'conjunction', gloss: 'and' },
  { lemma: 'в', pos: 'preposition', gloss: 'in, into' },
  { lemma: 'на', pos: 'preposition', gloss: 'on, onto' },
  { lemma: 'про', pos: 'preposition', gloss: 'about' },
  { lemma: 'без', pos: 'preposition', gloss: 'without' },
  { lemma: 'из', pos: 'preposition', gloss: 'out of, from' },
  { lemma: 'как', pos: 'conjunction', gloss: 'how; like, as' },
  { lemma: 'но', pos: 'conjunction', gloss: 'but' },
  { lemma: 'быть', pos: 'verb', gloss: 'to be', forms: ['будем', 'будет', 'буду', 'был', 'была'] },
];

const INDEX = new Map<string, Entry>();
for (const entry of ENTRIES) {
  INDEX.set(normalizeWord(entry.lemma), entry);
  for (const form of entry.forms ?? []) {
    INDEX.set(normalizeWord(form), entry);
  }
}

export function lookupWord(raw: string): WordDefinition {
  const word = raw.trim();
  const hit = findWord(word);
  if (hit) return hit;
  return {
    word,
    lemma: word.toLowerCase(),
    translit: transliterate(word),
    partOfSpeech: '—',
    gloss: 'Нет в офлайн-словаре',
    note: 'Включите ИИ-ассистента в настройках, чтобы разобрать это слово.',
  };
}

/** The bundled-only lookup: returns null when the word isn't in the glossary,
 * so callers can decide whether to reach for a network fallback. */
export function findWord(raw: string): WordDefinition | null {
  const word = raw.trim();
  const hit = INDEX.get(normalizeWord(word));
  if (!hit) return null;
  return {
    word,
    lemma: hit.lemma,
    translit: transliterate(word),
    partOfSpeech: hit.pos,
    gloss: hit.gloss,
    ...(hit.note !== undefined ? { note: hit.note } : {}),
  };
}
