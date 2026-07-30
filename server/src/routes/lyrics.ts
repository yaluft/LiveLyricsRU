import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import fetch from 'node-fetch';

const QuerySchema = z.object({
  artist: z.string().default(''),
  title: z.string().default(''),
});

interface LrclibResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

export const lyricsRoute: FastifyPluginAsync = async (app) => {
  app.get('/lyrics', async (request, reply) => {
    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid params' });
    }

    const { artist, title } = parsed.data;
    const q = `${artist} ${title}`.trim();
    if (!q) return reply.code(400).send({ error: 'Provide artist or title' });

    try {
      async function fetchLrclib(query: string): Promise<LrclibResult[]> {
        const resp = await fetch(
          `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`,
          { headers: { 'User-Agent': 'lyrics-app/1.0' } }
        );
        if (!resp.ok) throw new Error(`LRCLIB responded ${resp.status}`);
        return (await resp.json()) as LrclibResult[];
      }

      let results = await fetchLrclib(q);

      // Fallback 1: try title-only (handles multi-artist strings)
      if (!results.length && title) {
        results = await fetchLrclib(title);
      }

      // Fallback 2: first artist token + title (e.g. "5'nizza Солдат")
      if (!results.length && artist && title) {
        const firstArtist = artist.split(/[,&]/)[0].trim();
        if (firstArtist !== artist) results = await fetchLrclib(`${firstArtist} ${title}`);
      }

      if (!results.length) {
        return reply.code(404).send({ error: 'Lyrics not found' });
      }

      const best = results.find((r) => r.syncedLyrics) ?? results[0];
      return {
        trackName: best.trackName,
        artistName: best.artistName,
        syncedLyrics: best.syncedLyrics ?? null,
        plainLyrics: best.plainLyrics ?? null,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, 'lyrics fetch failed');
      return reply.code(502).send({ error: msg });
    }
  });
};
