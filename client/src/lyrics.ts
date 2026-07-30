import { apiLyrics, apiTranslate, type TrackInfo } from './api.js';

// ── Types ────────────────────────────────────────────────
interface WordData {
  word: string;
  start: number;
  end: number;
  /** 0.6–1.6 — relative visual weight based on syllables + length + emphasis */
  weight: number;
}

interface LrcLine {
  time: number;
  endTime: number;
  words: WordData[];
  /** weight of the whole line (avg word weight, scaled by word count) */
  lineWeight: number;
}

// ── DOM refs ────────────────────────────────────────────
const lyricsContainer  = document.getElementById('lyrics') as HTMLDivElement;
const optPronunciation = document.getElementById('opt-pronunciation') as HTMLInputElement;
const optTranslation   = document.getElementById('opt-translation') as HTMLInputElement;
const translateStatus  = document.getElementById('translate-status') as HTMLDivElement;
const optsBtn          = document.getElementById('opts-btn') as HTMLButtonElement;
const optionsPanel     = document.getElementById('options-panel') as HTMLDivElement;

// ── State ───────────────────────────────────────────────
let lrcData: LrcLine[]  = [];
interface WordEl { el: HTMLSpanElement; data: WordData; lineIdx: number; }
let wordEls: WordEl[]   = [];
let lineEls: Array<{
  div: HTMLDivElement;
  wordsRow: HTMLDivElement;
  transEl: HTMLDivElement | null;
}> = [];
let lastLineIdx = -1;
let currentBands = { bass: 0, mid: 0, treble: 0, energy: 0 };

// ── Options panel toggle ─────────────────────────────────
optsBtn.addEventListener('click', () => {
  const hidden = optionsPanel.classList.toggle('hidden');
  optsBtn.classList.toggle('active', !hidden);
});

// ── Russian syllable counter ──────────────────────────────
const VOWELS = /[аеёиоуыэюяАЕЁИОУЫЭЮЯaeioуAEIOU]/g;
function countSyllables(word: string): number {
  return Math.max(1, (word.match(VOWELS) ?? []).length);
}

// ── Word weight scoring ───────────────────────────────────
// Narrow range 0.80–1.20 so size differences are noticeable but not jarring
const EMPHASIS_CHARS = /[!?…]/;
function wordWeight(word: string, lineSyllableTotal: number): number {
  const clean      = word.replace(/[^а-яёА-ЯЁa-zA-Z]/g, '');
  const sylls      = countSyllables(clean);
  // Syllable factor 0.88–1.10
  const syllFactor = Math.min(1.10, 0.88 + sylls * 0.08);
  // Length factor 0.92–1.08
  const lenFactor  = Math.min(1.08, 0.92 + clean.length * 0.018);
  const emphasis   = EMPHASIS_CHARS.test(word) ? 1.08 : 1.0;
  const raw = syllFactor * lenFactor * emphasis;
  return Math.max(0.80, Math.min(1.20, raw));
}

// ── LRC parser ───────────────────────────────────────────
function parseLRC(lrc: string): LrcLine[] {
  const re = /\[(\d+):(\d+\.\d+)\](.*)/;
  const raw: Array<{ time: number; text: string }> = [];

  for (const line of lrc.split('\n')) {
    const m = line.match(re);
    if (!m) continue;
    const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
    const text = m[3].trim();
    if (text) raw.push({ time, text });
  }

  return raw.map(({ time, text }, i) => {
    const nextTime = i + 1 < raw.length ? raw[i + 1].time : time + 4;
    const wordTokens = text.split(/\s+/).filter(Boolean);
    const dur = nextTime - time;

    // Weight each word, then compute timing weighted by duration proportion
    const totalSylls = wordTokens.reduce((s, w) => s + countSyllables(w), 0);
    let cursor = time;
    const words: WordData[] = wordTokens.map((w) => {
      const sylls  = countSyllables(w);
      const share  = sylls / Math.max(totalSylls, 1);
      const wDur   = dur * share;
      const start  = cursor;
      cursor += wDur;
      return { word: w, start, end: cursor, weight: wordWeight(w, totalSylls) };
    });

    const lineWeight = words.length
      ? words.reduce((s, w) => s + w.weight, 0) / words.length
      : 1;

    return { time, endTime: nextTime, words, lineWeight };
  });
}

function plainToLines(plain: string): LrcLine[] {
  return plain.split('\n').filter((l) => l.trim()).map((text, i) => {
    const wordTokens = text.split(/\s+/).filter(Boolean);
    const totalSylls = wordTokens.reduce((s, w) => s + countSyllables(w), 0);
    let cursor = i * 3;
    const words: WordData[] = wordTokens.map((w) => {
      const share = countSyllables(w) / Math.max(totalSylls, 1);
      const start = cursor; cursor += 3 * share;
      return { word: w, start, end: cursor, weight: wordWeight(w, totalSylls) };
    });
    return { time: i * 3, endTime: (i + 1) * 3, words, lineWeight: 1 };
  });
}

// ── Russian → Latin transliteration (offline) ────────────
const TRANSLIT: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'ye',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:"'",э:'e',ю:'yu',я:'ya',
};
function romanise(word: string): string {
  return word.toLowerCase().split('').map((c) => TRANSLIT[c] ?? c).join('');
}

// ── Render ───────────────────────────────────────────────
function renderLyrics(data: LrcLine[], translations?: string[]): void {
  lrcData   = data;
  wordEls   = [];
  lineEls   = [];
  lastLineIdx = -1;
  lyricsContainer.innerHTML = '';

  data.forEach((line, li) => {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'line future';

    // Words row
    const wordsRow = document.createElement('div');
    wordsRow.className = 'words-row';

    line.words.forEach((w) => {
      const wrap = document.createElement('span');
      wrap.className = 'word-wrap';

      // Pronunciation label (above word)
      const roman = document.createElement('span');
      roman.className = 'word-roman';
      roman.textContent = romanise(w.word.replace(/[^а-яёА-ЯЁ]/g, ''));

      // The word span — font-size driven by weight via CSS var
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = w.word;
      span.style.setProperty('--ws', String(w.weight.toFixed(3)));

      wrap.appendChild(roman);
      wrap.appendChild(span);
      wordsRow.appendChild(wrap);

      wordEls.push({ el: span, data: w, lineIdx: li });
    });

    lineDiv.appendChild(wordsRow);

    // Translation row (below line)
    let transEl: HTMLDivElement | null = null;
    transEl = document.createElement('div');
    transEl.className = 'line-translation';
    transEl.textContent = translations?.[li] ?? '';
    lineDiv.appendChild(transEl);

    lyricsContainer.appendChild(lineDiv);
    lineEls.push({ div: lineDiv, wordsRow, transEl });
  });

  // Apply current toggle state
  applyToggles();
}

// ── Toggle show/hide ─────────────────────────────────────
function applyToggles(): void {
  const showRoman = optPronunciation.checked;
  const showTrans = optTranslation.checked;
  lineEls.forEach(({ div }) => {
    div.classList.toggle('show-roman', showRoman);
    div.classList.toggle('show-translation', showTrans);
  });
}

optPronunciation.addEventListener('change', applyToggles);
optTranslation.addEventListener('change', applyToggles);

// ── Sync ─────────────────────────────────────────────────
export function syncLyrics(currentTime: number): void {
  if (!lrcData.length) return;

  let activeLineIdx = -1;
  for (let i = lrcData.length - 1; i >= 0; i--) {
    if (currentTime >= lrcData[i].time) { activeLineIdx = i; break; }
  }

  if (activeLineIdx !== lastLineIdx) {
    lineEls.forEach(({ div }, i) => {
      div.classList.remove('active', 'past', 'future');
      if (i < activeLineIdx)  div.classList.add('past');
      if (i === activeLineIdx) div.classList.add('active');
      if (i > activeLineIdx)  div.classList.add('future');
    });
    if (activeLineIdx >= 0) {
      lineEls[activeLineIdx].div.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    lastLineIdx = activeLineIdx;
  }

  // Word highlight + reactive sizing
  const energy = currentBands.energy;
  const mid    = currentBands.mid;

  wordEls.forEach(({ el, data }) => {
    const isLit = currentTime >= data.start && currentTime < data.end;
    const progress = isLit
      ? Math.min(1, (currentTime - data.start) / Math.max(data.end - data.start, 0.001))
      : 0;

    if (isLit) {
      // Subtle bell-curve scale: peaks midway through the word
      const bell  = Math.sin(progress * Math.PI); // 0→1→0
      const boost = 1.0 + energy * 0.20 * bell + mid * 0.10;
      const scale = (data.weight * boost).toFixed(3);
      el.style.setProperty('--ws', scale);
      el.classList.add('lit');
      // Glow proportional to energy + word weight, but kept tasteful
      const glowPx = Math.round(14 + energy * 18 * data.weight);
      el.style.textShadow = [
        `0 0 ${glowPx}px rgba(220,110,255,${(0.80 + energy * 0.18).toFixed(2)})`,
        `0 0 ${Math.round(glowPx * 0.4)}px rgba(220,110,255,.50)`,
        `0 0 ${Math.round(glowPx * 1.8)}px rgba(180,60,255,${(0.14 + energy * 0.14).toFixed(2)})`,
      ].join(',');
    } else {
      el.classList.remove('lit');
      el.style.setProperty('--ws', data.weight.toFixed(3));
      el.style.textShadow = '';
    }
  });
}

// Audio bands event
document.addEventListener('audio-bands', (e) => {
  currentBands = (e as CustomEvent<typeof currentBands>).detail;
});

// Timeupdate → sync
document.addEventListener('audio-timeupdate', (e) => {
  syncLyrics((e as CustomEvent<number>).detail);
});

// ── Translation fetch ────────────────────────────────────
let currentRawLines: string[] = [];

async function fetchAndApplyTranslation(): Promise<void> {
  if (!currentRawLines.length) return;
  translateStatus.textContent = 'Translating…';
  try {
    const lines = await apiTranslate(currentRawLines);
    translateStatus.textContent = '';
    // Fill translation into existing line elements
    lineEls.forEach(({ transEl }, i) => {
      if (transEl) transEl.textContent = lines[i] ?? '';
    });
  } catch (err: unknown) {
    translateStatus.textContent = `Translation unavailable`;
  }
}

optTranslation.addEventListener('change', () => {
  if (optTranslation.checked && currentRawLines.length) {
    fetchAndApplyTranslation();
  }
});

// ── Track loaded ─────────────────────────────────────────
document.addEventListener('track-loaded', async (e) => {
  const { track } = (e as CustomEvent<{ track: TrackInfo }>).detail;
  lyricsContainer.innerHTML = '';
  currentRawLines = [];
  setStatus('Fetching lyrics…');
  try {
    const result = await apiLyrics(track.artist, track.title);
    let data: LrcLine[];
    if (result.syncedLyrics) {
      data = parseLRC(result.syncedLyrics);
      setStatus(`${result.artistName} — ${result.trackName}`);
    } else if (result.plainLyrics) {
      data = plainToLines(result.plainLyrics);
      setStatus(`${result.artistName} — ${result.trackName} (no timestamps)`);
    } else {
      setStatus('Lyrics not found');
      return;
    }
    currentRawLines = data.map((l) => l.words.map((w) => w.word).join(' '));
    renderLyrics(data);

    // If translation is already enabled, fetch immediately
    if (optTranslation.checked) fetchAndApplyTranslation();
  } catch (err: unknown) {
    setStatus(`Lyrics not found: ${err instanceof Error ? err.message : String(err)}`);
  }
});

function setStatus(msg: string): void {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}
