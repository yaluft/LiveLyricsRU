import { apiStreamUrl, type TrackInfo } from './api.js';
import { setEnergyBands } from './bg.js';

const audio       = document.getElementById('audio') as HTMLAudioElement;
const playerSect  = document.getElementById('player-section') as HTMLDivElement;
const playBtn     = document.getElementById('play-btn') as HTMLButtonElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const progressFill= document.getElementById('progress-fill') as HTMLDivElement;
const curTimeEl   = document.getElementById('cur-time') as HTMLSpanElement;
const durTimeEl   = document.getElementById('dur-time') as HTMLSpanElement;
const volSlider   = document.getElementById('vol-slider') as HTMLInputElement;
const thumbEl     = document.getElementById('thumb') as HTMLImageElement;
const titleEl     = document.getElementById('track-title') as HTMLSpanElement;
const artistEl    = document.getElementById('track-artist') as HTMLSpanElement;
const sourceBadge = document.getElementById('source-badge') as HTMLDivElement;

audio.volume = 0.8;

// ── Web Audio — multi-band analyser ─────────────────────
let actx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let freqData: Uint8Array | null = null;
let analyserAttached = false;

// Exported so lyrics.ts can also read energy reactively
export let currentEnergy = 0;

function setupAnalyser(): void {
  if (analyserAttached) return;
  actx = new AudioContext();
  const src = actx.createMediaElementSource(audio);
  analyser = actx.createAnalyser();
  analyser.fftSize = 512;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  src.connect(analyser);
  analyser.connect(actx.destination);
  analyserAttached = true;

  (function tick() {
    requestAnimationFrame(tick);
    if (!analyser || !freqData) return;
    analyser.getByteFrequencyData(freqData);

    const len = freqData.length;
    // Split into bass (0–10%), mid (10–50%), treble (50–100%)
    const bassEnd   = Math.floor(len * 0.10);
    const midEnd    = Math.floor(len * 0.50);

    let bassSum = 0, midSum = 0, trebleSum = 0;
    for (let i = 0; i < bassEnd; i++)        bassSum   += freqData[i];
    for (let i = bassEnd; i < midEnd; i++)    midSum    += freqData[i];
    for (let i = midEnd; i < len; i++)        trebleSum += freqData[i];

    const bass   = Math.min(1, bassSum   / bassEnd   / 140);
    const mid    = Math.min(1, midSum    / (midEnd - bassEnd) / 110);
    const treble = Math.min(1, trebleSum / (len - midEnd)    / 90);

    currentEnergy = bass * 0.5 + mid * 0.35 + treble * 0.15;

    setEnergyBands({ bass, mid, treble });

    // Dispatch band event for lyrics module
    document.dispatchEvent(new CustomEvent('audio-bands', {
      detail: { bass, mid, treble, energy: currentEnergy },
    }));
  })();
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ── Seek ─────────────────────────────────────────────────
let seeking = false;
function seekTo(e: MouseEvent): void {
  const rect = progressBar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (audio.duration) audio.currentTime = ratio * audio.duration;
}
progressBar.addEventListener('mousedown', (e) => { seeking = true; seekTo(e); });
document.addEventListener('mousemove', (e) => { if (seeking) seekTo(e); });
document.addEventListener('mouseup', () => { seeking = false; });

// ── rAF sync loop — 60Hz currentTime → lyrics + progress bar ──
let rafPlaying = false;
function rafLoop(): void {
  if (!rafPlaying) return;
  const ct = audio.currentTime;
  if (!seeking && audio.duration) {
    progressFill.style.width = `${(ct / audio.duration) * 100}%`;
  }
  curTimeEl.textContent = fmt(ct);
  // Dispatch at 60fps for lyrics module
  document.dispatchEvent(new CustomEvent('audio-timeupdate', { detail: ct }));
  requestAnimationFrame(rafLoop);
}

// ── Audio events ─────────────────────────────────────────
// Keep timeupdate only for duration/time display fallback on slow systems
audio.addEventListener('timeupdate', () => {
  if (!rafPlaying) curTimeEl.textContent = fmt(audio.currentTime);
});

audio.addEventListener('durationchange', () => {
  durTimeEl.textContent = audio.duration ? fmt(audio.duration) : '–:––';
});

audio.addEventListener('play',  () => { playBtn.textContent = '⏸'; rafPlaying = true;  requestAnimationFrame(rafLoop); });
audio.addEventListener('pause', () => { playBtn.textContent = '▶';  rafPlaying = false; setEnergyBands({ bass: 0, mid: 0, treble: 0 }); });
audio.addEventListener('ended', () => { playBtn.textContent = '▶';  rafPlaying = false; setEnergyBands({ bass: 0, mid: 0, treble: 0 }); });

playBtn.addEventListener('click', () => {
  if (audio.paused) audio.play();
  else audio.pause();
});
volSlider.addEventListener('input', () => { audio.volume = parseFloat(volSlider.value); });

// ── Load track ───────────────────────────────────────────
export function loadTrack(track: TrackInfo): void {
  titleEl.textContent  = track.title;
  artistEl.textContent = track.artist;
  thumbEl.src          = track.thumbnail;
  thumbEl.style.display = track.thumbnail ? 'block' : 'none';

  const sourceLabels: Record<string, string> = {
    youtube: '▶ YouTube', vk: '🎵 VK', spotify: '🎧 Spotify (30s)', direct: '🔗 Direct',
  };
  sourceBadge.textContent = sourceLabels[track.source] ?? track.source;

  audio.src = apiStreamUrl(track.streamUrl);
  playerSect.classList.remove('hidden');
  progressFill.style.width = '0';
  curTimeEl.textContent = '0:00';
  durTimeEl.textContent = track.durationSec ? fmt(track.durationSec) : '–:––';

  audio.load();
  audio.play().then(() => {
    setupAnalyser();
    if (actx?.state === 'suspended') actx.resume();
  }).catch(() => {});
}

document.addEventListener('track-loaded', (e) => {
  loadTrack((e as CustomEvent<{ track: TrackInfo }>).detail.track);
});
