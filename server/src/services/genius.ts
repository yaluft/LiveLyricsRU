import { config } from '../config.js';

/**
 * Minimal Genius scraper: best-effort, no API key. Tries to find a lyrics page by
 * searching the public site and extracting text blocks. This is a fragile web
 * scraping approach and should be considered a best-effort fallback only.
 */

export async function fetchGeniusLyrics(track: { title: string; artist?: string }) {
  const query = encodeURIComponent(`${track.artist ? track.artist + ' ' : ''}${track.title}`);
  const searchUrl = `https://genius.com/search?q=${query}`;
  try {
    const res = await fetch(searchUrl, { method: 'GET' });
    if (!res.ok) return null;
    const html = await res.text();
    // Find first /lyrics page link
    const m = html.match(/href="(https:\/\/genius.com\/[^"]+-lyrics)"/i);
    if (!m) return null;
    const pageUrl = m[1];
    const pageRes = await fetch(pageUrl, { method: 'GET' });
    if (!pageRes.ok) return null;
    const pageHtml = await pageRes.text();
    // Extract lyrics containers: modern pages use data-lyrics-container attributes
    const parts = Array.from(pageHtml.matchAll(/<div[^>]+data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi)).map(
      (x) => x[1],
    );
    if (!parts.length) {
      // Fallback: look for <div class="lyrics"> blocks
      const fallback = pageHtml.match(/<div class="lyrics">([\s\S]*?)<\/div>/i);
      if (fallback) parts.push(fallback[1]);
    }
    if (!parts.length) return null;
    // Strip tags and join
    const text = parts
      .map((p) => p.replace(/<br[^>]*>/gi, '\n').replace(/<[^>]+>/g, ''))
      .join('\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
    if (!text) return null;
    return { trackId: `genius:${encodeURIComponent(pageUrl)}`, kind: 'plain', source: 'genius', sourceLabel: 'Genius (scraped)', lines: text };
  } catch (error) {
    return null;
  }
}
