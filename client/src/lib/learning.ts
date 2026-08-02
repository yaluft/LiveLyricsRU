import type { LyricLine, Lyrics, SavedWord } from '@lyrika/shared';

/** Rough difficulty 1–5 from line length, speed and unique word count. */
export function scoreDifficulty(lyrics: Lyrics, durationSec: number): number {
  if (!lyrics.lines.length || durationSec <= 0) return 1;
  const words = lyrics.lines.flatMap((line) => line.text.split(/\s+/).filter(Boolean));
  const unique = new Set(words.map((w) => w.toLowerCase())).size;
  const wpm = (words.length / durationSec) * 60;
  const avgLen = words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1);
  const raw = wpm / 18 + avgLen / 8 + unique / 40;
  return Math.min(5, Math.max(1, Math.round(raw)));
}

/** Pick ~30% of content words to hide in karaoke blank mode. */
export function blankWordIndices(line: LyricLine, seed: number): Set<number> {
  const indices = line.words
    .map((word, i) => ({ i, hide: word.text.length > 2 && !/^[,.!?…—–-]+$/.test(word.text) }))
    .filter((entry) => entry.hide)
    .map((entry) => entry.i);
  const hidden = new Set<number>();
  let s = seed;
  for (const index of indices) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    if (s % 3 === 0) hidden.add(index);
  }
  return hidden;
}

export function vocabularyHeat(
  word: string,
  saved: SavedWord[],
): { known: boolean; intensity: number } {
  const hit = saved.find((entry) => entry.word.toLowerCase() === word.toLowerCase());
  if (!hit) return { known: false, intensity: 0 };
  return { known: true, intensity: Math.min(1, hit.seenCount / 5) };
}

export function lyricsToLrc(lyrics: Lyrics): string {
  return lyrics.lines
    .map((line) => {
      const min = Math.floor(line.time / 60);
      const sec = line.time - min * 60;
      const stamp = `[${String(min).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}]`;
      return `${stamp}${line.text}`;
    })
    .join('\n');
}

export function downloadText(filename: string, body: string, mime: string): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
