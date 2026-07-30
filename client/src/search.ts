import { apiSearch, apiResolve, type TrackInfo, type SearchResult } from './api.js';

const input = document.getElementById('search-input') as HTMLInputElement;
const btn = document.getElementById('search-btn') as HTMLButtonElement;
const dropdown = document.getElementById('dropdown') as HTMLDivElement;
const histRow = document.getElementById('history-row') as HTMLDivElement;

const HISTORY_KEY = 'lyrics-app:history';
const MAX_HISTORY = 20;

export interface HistoryItem {
  title: string;
  artist: string;
  thumbnail: string;
  url: string; // original source URL
  ts: number;
}

function loadHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryItem[]; }
  catch { return []; }
}

export function saveToHistory(track: TrackInfo, sourceUrl: string): void {
  const items = loadHistory().filter((h) => h.url !== sourceUrl);
  items.unshift({ title: track.title, artist: track.artist, thumbnail: track.thumbnail, url: sourceUrl, ts: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  renderHistory();
}

function renderHistory(): void {
  const items = loadHistory();
  if (!items.length) { histRow.classList.add('hidden'); return; }
  histRow.classList.remove('hidden');
  histRow.innerHTML = '';
  items.forEach((item) => {
    const img = document.createElement('img');
    img.className = 'hist-thumb';
    img.src = item.thumbnail || '';
    img.alt = item.title;
    img.title = `${item.title} — ${item.artist}`;
    img.addEventListener('click', () => { input.value = item.url; loadUrl(item.url); });
    histRow.appendChild(img);
  });
}

function closeDropdown(): void { dropdown.classList.add('hidden'); dropdown.innerHTML = ''; }

function renderResults(results: SearchResult[]): void {
  if (!results.length) { closeDropdown(); return; }
  dropdown.classList.remove('hidden');
  dropdown.innerHTML = '';
  results.forEach((r) => {
    const div = document.createElement('div');
    div.className = 'result-item';
    const dur = r.durationSec ? `${Math.floor(r.durationSec / 60)}:${String(r.durationSec % 60).padStart(2, '0')}` : '';
    div.innerHTML = `
      <img src="${r.thumbnail}" alt="" loading="lazy"/>
      <div class="result-info">
        <div class="result-title">${r.title}</div>
        <div class="result-artist">${r.artist}</div>
      </div>
      <span class="result-dur">${dur}</span>
    `;
    div.addEventListener('click', () => { closeDropdown(); loadUrl(r.youtubeUrl); });
    dropdown.appendChild(div);
  });
}

async function search(q: string): Promise<void> {
  setStatus('Ищу…');
  try {
    const results = await apiSearch(q);
    renderResults(results);
    setStatus('');
  } catch (err: unknown) {
    setStatus(`Ошибка поиска: ${err instanceof Error ? err.message : String(err)}`);
    closeDropdown();
  }
}

export async function loadUrl(url: string): Promise<void> {
  closeDropdown();
  setStatus('Загружаю трек…');
  try {
    const track = await apiResolve(url);
    saveToHistory(track, url);
    document.dispatchEvent(new CustomEvent('track-loaded', { detail: { track, sourceUrl: url } }));
    setStatus('');
  } catch (err: unknown) {
    setStatus(`Ошибка: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Debounce
let debTimer: ReturnType<typeof setTimeout> | null = null;
input.addEventListener('input', () => {
  const val = input.value.trim();
  if (!val) { closeDropdown(); return; }
  if (/^https?:\/\//.test(val)) { closeDropdown(); return; } // URL paste — skip search
  if (debTimer) clearTimeout(debTimer);
  debTimer = setTimeout(() => search(val), 320);
});

input.addEventListener('focus', () => renderHistory());
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (debTimer) clearTimeout(debTimer);
    const val = input.value.trim();
    if (!val) return;
    if (/^https?:\/\//.test(val)) { loadUrl(val); }
    else { search(val); }
  }
  if (e.key === 'Escape') closeDropdown();
});

btn.addEventListener('click', () => {
  const val = input.value.trim();
  if (!val) return;
  if (/^https?:\/\//.test(val)) { loadUrl(val); }
  else { search(val); }
});

document.addEventListener('click', (e) => {
  if (!dropdown.contains(e.target as Node) && e.target !== input) closeDropdown();
});

// init history on load
renderHistory();

function setStatus(msg: string): void {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}
