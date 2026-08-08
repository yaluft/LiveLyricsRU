export type Lang = 'ru' | 'en' | 'both';

type Pair = readonly [ru: string, en: string];

export const STRINGS = {
  appName: ['Лирика', 'Lyrika'],

  navNowPlaying: ['Сейчас играет', 'Now playing'],
  navQueue: ['Очередь', 'Queue'],
  navVocabulary: ['Словарь', 'Vocabulary'],
  navClips: ['Мои клипы', 'My clips'],
  navSession: ['Сессия', 'Session'],
  navSettings: ['Настройки', 'Settings'],
  navRecent: ['Недавние', 'Recent'],

  searchPlaceholder: ['Поиск или ссылка…', 'Search or paste a link…'],
  searchLanding: [
    'Земфира, или youtube.com/… vk.com/… spotify.com/…',
    'Zemfira, or youtube.com/… vk.com/… spotify.com/…',
  ],
  searchAction: ['Найти', 'Search'],
  searchResults: ['результатов', 'results'],
  filters: ['Фильтры', 'Filters'],
  filterAll: ['Все', 'All'],
  filterSynced: ['С синхро-текстом', 'Synced lyrics'],
  filterYoutube: ['YouTube', 'YouTube'],
  tryThese: ['Пробуйте:', 'Try:'],
  continueListening: ['Продолжить', 'Continue'],
  landingBlurb: [
    'Вставьте ссылку или найдите песню — слова, транскрипция и перевод появятся синхронно с музыкой.',
    'Paste a link or search for a song — lyrics, pronunciation and translation arrive in time with the music.',
  ],

  loadingStream: ['Загружаю поток…', 'Loading stream…'],
  loadingLyrics: ['Ищу текст…', 'Finding lyrics…'],
  addToQueue: ['+ В очередь', '+ Queue'],
  retry: ['Повторить', 'Retry'],
  tryYoutube: ['Попробовать вариант с YouTube →', 'Try the YouTube version →'],
  syncedBadge: ['LRC синхро', 'LRC synced'],
  textOnlyBadge: ['только текст', 'text only'],
  sampleBadge: ['демо-каталог', 'demo catalogue'],

  noLyricsPrompt: [
    'Нет текста? ИИ-ассистент соберёт и разметит слова по времени из ссылки или названия.',
    'No lyrics? The AI assistant drafts and time-aligns them from a link or a title.',
  ],
  create: ['Создать', 'Create'],
  generate: ['Сгенерировать (ИИ)', 'Generate (AI)'],
  generateFailed: [
    'Не удалось сгенерировать текст. Показываем обычный поиск текста.',
    "Couldn't generate lyrics. Falling back to the regular lyrics search.",
  ],
  pasteLrc: ['Вставить LRC', 'Paste LRC'],
  pasteLrcPlaceholder: [
    'Вставьте LRC (со строками вида [00:12.34] …) или простой текст',
    'Paste an LRC (lines like [00:12.34] …) or plain text',
  ],
  apply: ['Применить', 'Apply'],

  nowSection: ['Сейчас', 'Now'],
  nextSection: ['Далее', 'Next'],
  relatedSection: ['Похожее', 'Related'],
  addAll: ['Добавить всё', 'Add all'],
  clearQueue: ['Очистить', 'Clear'],
  queueEmpty: ['Очередь пуста', 'The queue is empty'],
  queueEmptyHint: ['Добавьте треки из поиска или из «похожего».', 'Add tracks from search or related.'],

  aboutArtist: ['Об исполнителе', 'About the artist'],
  topSongs: ['Топ-10 песен', 'Top 10 songs'],
  topCountries: ['Топ-5 стран', 'Top 5 countries'],
  discography: ['Дискография', 'Discography'],
  albums: ['альбомов', 'albums'],
  showAllTen: ['Показать все 10', 'Show all 10'],
  estimatedNote: ['Оценочные данные', 'Estimated figures'],

  vocabTitle: ['Словарь', 'Vocabulary'],
  vocabWords: ['Слова', 'Words'],
  vocabLines: ['Строки', 'Lines'],
  vocabClips: ['Клипы', 'Clips'],
  savedLines: ['Сохранённые строки', 'Saved lines'],
  exportCsv: ['Экспорт CSV', 'Export CSV'],
  studyWords: ['Учить', 'Study'],
  words: ['слова', 'words'],
  lines: ['строк', 'lines'],
  songs: ['песен', 'songs'],
  vocabEmpty: ['Пока пусто', 'Nothing saved yet'],
  vocabEmptyHint: [
    'Нажмите на слово в тексте, чтобы сохранить его.',
    'Tap a word in the lyrics to save it.',
  ],
  saveWord: ['+ Сохранить', '+ Save word'],
  saved: ['Сохранено', 'Saved'],
  hear: ['▸ Озвучить', '▸ Hear'],
  repeat: ['↻ Повтор', '↻ Repeat'],
  clip: ['✂ Клип', '✂ Clip'],
  remove: ['Удалить', 'Remove'],

  settingsTitle: ['Настройки', 'Settings'],
  bgSection: ['Фон', 'Background'],
  bgOcean: ['Океан', 'Ocean'],
  bgVisualizer: ['Аудиоволны', 'Audio waves'],
  bgFieldLines: ['Магнитное поле', 'Field lines'],
  bgRefraction: ['Рефракция', 'Refraction'],
  bgFracture: ['Разлом', 'Fracture'],
  waveCalm: ['Штиль', 'Calm'],
  waveSurf: ['Прибой', 'Surf'],
  waveNight: ['Ночь', 'Night'],
  waveLagoon: ['Лагуна', 'Lagoon'],
  waveHeight: ['Высота волн', 'Wave height'],
  reactivity: ['Реакция на музыку', 'Music reactivity'],
  lyricBlur: ['Размытие за текстом', 'Blur behind lyrics'],
  ecoMode: [
    'Экономный режим (без 3D на слабых устройствах)',
    'Eco mode (no 3D on low-power devices)',
  ],
  sourcesSection: ['Базы текстов · порядок опроса', 'Lyric sources · query order'],
  sourceLrclib: ['LRCLIB.net', 'LRCLIB.net'],
  sourceNetease: ['NetEase Cloud Music', 'NetEase Cloud Music'],
  sourceMusixmatch: ['Musixmatch', 'Musixmatch'],
  sourceGenius: ['Genius (текст)', 'Genius (text)'],
  sourceCustom: ['Своя база (URL)', 'Custom source (URL)'],
  sourceSynced: ['синхро', 'synced'],
  sourceUntimed: ['без времени', 'no timings'],
  sourceUnset: ['не задано', 'not set'],
  aiSection: ['ИИ-ассистент текстов', 'AI lyric assistant'],
  aiBlurb: [
    'Когда базы молчат — ассистент расшифровывает песню по ссылке или названию, размечает слова по времени и добавляет транскрипцию с переводом. Результат помечается как черновик, его можно править построчно.',
    'When the sources come up empty, the assistant transcribes the song from a link or a title, time-aligns the words and adds pronunciation with a translation. The result is flagged as a draft you can edit line by line.',
  ],
  aiAuto: ['Авто при отсутствии текста', 'Auto when no lyrics'],
  aiTranslit: ['Транскрипция', 'Pronunciation'],
  aiTranslation: ['Перевод EN', 'EN translation'],
  aiShare: ['Делиться правками', 'Share corrections'],
  langSection: ['Язык интерфейса', 'Interface language'],
  langRu: ['Русский', 'Русский'],
  langEn: ['English', 'English'],
  langBoth: ['Оба (RU + EN)', 'Both (RU + EN)'],
  displaySection: ['Отображение текста', 'Lyric display'],
  showTranslit: ['Транскрипция над словами', 'Pronunciation above words'],
  showTranslation: ['Перевод под строкой', 'Translation under the line'],
  layoutSection: ['Раскладка', 'Layout'],
  layoutStage: ['Сцена', 'Stage'],
  layoutStudio: ['Студия', 'Studio'],
  layoutStageHint: [
    'Текст во весь экран, один плавающий пульт.',
    'Full-screen lyrics, one floating controller.',
  ],
  layoutStudioHint: [
    'Библиотека слева, панель артиста справа.',
    'Library rail left, artist panel right.',
  ],

  clipTitle: ['Клип · 10 секунд', 'Clip · 10 seconds'],
  clipWindow: ['Окно', 'Window'],
  clipShow: ['Что показать', 'What to show'],
  clipPublish: ['Опубликовать в ленту', 'Publish to the feed'],
  clipDownload: ['Скачать MP4', 'Download MP4'],
  clipFeed: ['Лента · сейчас слушают', 'Feed · listening now'],
  clipListen: ['Слушать', 'Listen'],
  clipWaves: ['Волны', 'Waves'],
  clipArtwork: ['Обложка', 'Artwork'],
  clipPublished: ['Клип опубликован в ленту', 'Clip published to the feed'],
  clipNoLine: ['Сначала выберите строку', 'Pick a line first'],

  loopLine: ['↻ Повтор строки', '↻ Loop line'],
  loopLineShort: ['↻ Повтор', '↻ Loop'],
  abRepeat: ['↻ A–B', '↻ A–B'],
  clipTenSec: ['✂ Клип 10с', '✂ Clip 10s'],
  speed: ['Скорость', 'Speed'],

  sessionTitle: ['Сессия', 'Session'],
  sessionBlurb: [
    'Слушайте вместе: у всех в комнате одна очередь и одна позиция в треке.',
    'Listen together: everyone in the room shares one queue and one playhead.',
  ],
  sessionCreate: ['Создать комнату', 'Create a room'],
  sessionSimulated: [
    'Синхронизация между устройствами ещё не подключена — комната работает локально.',
    'Cross-device sync is not wired up yet — the room is local only.',
  ],

  close: ['Закрыть', 'Close'],
  cancel: ['Отмена', 'Cancel'],
  back: ['Назад', 'Back'],
  play: ['Играть', 'Play'],
  pause: ['Пауза', 'Pause'],
  demoMode: ['демо-режим', 'demo mode'],
  draftBadge: ['черновик', 'draft'],
  simulatedBadge: ['симуляция', 'simulated'],
  noTranslation: ['перевод недоступен', 'no translation available'],
  nothingPlaying: ['Ничего не играет', 'Nothing is playing'],
  openSearch: ['Открыть поиск', 'Open search'],
} as const satisfies Record<string, Pair>;

export type StringKey = keyof typeof STRINGS;

const BOTH_MAX_LENGTH = 26;

export function translate(key: StringKey, lang: Lang): string {
  const pair = STRINGS[key] as Pair;
  if (lang === 'en') return pair[1];
  if (lang === 'ru') return pair[0];
  if (pair[0] === pair[1]) return pair[0];
  const combined = `${pair[0]} / ${pair[1]}`;
  // Only pair them up where the control has room; otherwise Russian leads.
  return combined.length <= BOTH_MAX_LENGTH ? combined : pair[0];
}

export function pair(key: StringKey): Pair {
  return STRINGS[key] as Pair;
}
