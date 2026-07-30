import './style.css';
import { setTheme, setBgMode, type BgMode } from './bg.js';
import './search.js';
import './player.js';
import './lyrics.js';
import { apiRelated, type SearchResult, type TrackInfo } from './api.js';
import { loadUrl } from './search.js';

// ── Declare all panel refs up front ──────────────────────
const optsBtn      = document.getElementById('opts-btn')      as HTMLButtonElement;
const optionsPanel = document.getElementById('options-panel') as HTMLDivElement;
const relatedBtn   = document.getElementById('related-btn')   as HTMLButtonElement;
const relatedPanel = document.getElementById('related-panel') as HTMLDivElement;
const relatedClose = document.getElementById('related-close') as HTMLButtonElement;
const relatedList  = document.getElementById('related-list')  as HTMLDivElement;
const dock         = document.getElementById('dock')          as HTMLDivElement;
const dockHandle   = document.getElementById('dock-handle')   as HTMLDivElement;
const searchInput  = document.getElementById('search-input')  as HTMLInputElement;

// ── Theme buttons ─────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setTheme(parseInt(btn.dataset['theme'] ?? '0', 10));
    document.querySelectorAll('.theme-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Background mode buttons ───────────────────────────────
document.querySelectorAll<HTMLButtonElement>('.bg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setBgMode(btn.dataset['bg'] as BgMode);
    document.querySelectorAll('.bg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Settings panel toggle ─────────────────────────────────
optsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const willShow = optionsPanel.classList.contains('hidden');
  optionsPanel.classList.toggle('hidden', !willShow);
  optsBtn.classList.toggle('active', willShow);
  if (willShow) {
    // opening settings — close related
    relatedPanel.classList.add('hidden');
    relatedBtn.classList.remove('active');
  }
});

// Close settings when clicking outside
document.addEventListener('click', (e) => {
  if (
    !optionsPanel.classList.contains('hidden') &&
    !optionsPanel.contains(e.target as Node) &&
    e.target !== optsBtn
  ) {
    optionsPanel.classList.add('hidden');
    optsBtn.classList.remove('active');
  }
});

// ── Dock auto-hide ────────────────────────────────────────
let dockHideTimer: ReturnType<typeof setTimeout> | null = null;
let dockPinned = false;

function showDock(): void {
  dock.classList.remove('dock-hidden');
  dock.classList.add('dock-visible');
  if (dockHideTimer) { clearTimeout(dockHideTimer); dockHideTimer = null; }
}

function scheduleDockHide(ms = 3500): void {
  if (dockPinned) return;
  if (dockHideTimer) clearTimeout(dockHideTimer);
  dockHideTimer = setTimeout(() => {
    dock.classList.remove('dock-visible');
    dock.classList.add('dock-hidden');
  }, ms);
}

dockHandle.addEventListener('click', () => {
  if (dock.classList.contains('dock-hidden')) {
    showDock(); scheduleDockHide(4000);
  } else {
    dock.classList.remove('dock-visible');
    dock.classList.add('dock-hidden');
  }
});

document.addEventListener('mousemove', (e) => {
  if (e.clientY > window.innerHeight - 80) showDock();
  else scheduleDockHide(3500);
});

document.addEventListener('touchstart', () => { showDock(); scheduleDockHide(4000); }, { passive: true });

searchInput.addEventListener('focus', () => { dockPinned = true;  showDock(); });
searchInput.addEventListener('blur',  () => { dockPinned = false; scheduleDockHide(2500); });

document.addEventListener('track-loaded', () => { showDock(); scheduleDockHide(4000); });

scheduleDockHide(5000);

// ── Related songs panel ───────────────────────────────────
relatedBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const willShow = relatedPanel.classList.contains('hidden');
  relatedPanel.classList.toggle('hidden', !willShow);
  relatedBtn.classList.toggle('active', willShow);
  if (willShow) {
    // opening related — close settings
    optionsPanel.classList.add('hidden');
    optsBtn.classList.remove('active');
  }
  showDock();
});

relatedClose.addEventListener('click', () => {
  relatedPanel.classList.add('hidden');
  relatedBtn.classList.remove('active');
});

function renderRelated(results: SearchResult[]): void {
  relatedList.innerHTML = '';
  if (!results.length) {
    relatedList.innerHTML = '<div style="padding:8px;font-size:12px;color:rgba(255,255,255,.3)">No results</div>';
    return;
  }
  results.forEach((r) => {
    const item = document.createElement('div');
    item.className = 'related-item';
    const dur = r.durationSec
      ? `${Math.floor(r.durationSec / 60)}:${String(r.durationSec % 60).padStart(2, '0')}`
      : '';
    item.innerHTML = `
      <img src="${r.thumbnail}" alt="" loading="lazy"/>
      <div class="result-info">
        <div class="result-title">${r.title}</div>
        <div class="result-artist">${r.artist}</div>
      </div>
      <span class="result-dur">${dur}</span>
    `;
    item.addEventListener('click', () => {
      relatedPanel.classList.add('hidden');
      relatedBtn.classList.remove('active');
      loadUrl(r.youtubeUrl);
    });
    relatedList.appendChild(item);
  });
}

document.addEventListener('track-loaded', async (e) => {
  const { track } = (e as CustomEvent<{ track: TrackInfo }>).detail;
  relatedList.innerHTML = '<div style="padding:8px;font-size:12px;color:rgba(255,255,255,.3)">Loading…</div>';
  try {
    const results = await apiRelated(track.artist, track.title);
    renderRelated(results);
  } catch {
    relatedList.innerHTML = '<div style="padding:8px;font-size:12px;color:rgba(255,255,255,.3)">Could not load related songs</div>';
  }
});
