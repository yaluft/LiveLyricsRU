import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const QuerySchema = z.object({ q: z.string().min(1) });

interface YtSearchResult {
  id?: string;
  title?: string;
  uploader?: string;
  artist?: string;
  thumbnail?: string;
  duration?: number;
  webpage_url?: string;
  url?: string;
}

export interface SearchResult {
  title: string;
  artist: string;
  thumbnail: string;
  durationSec: number | null;
  youtubeUrl: string;
}

export const searchRoute: FastifyPluginAsync = async (app) => {
  app.get('/search', async (request, reply) => {
    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Missing required param: q' });
    }

    const query = parsed.data.q;
    try {
      const { stdout } = await execFileAsync('python3', [
        '-m', 'yt_dlp',
        `ytsearch8:${query}`,
        '--dump-json',
        '--flat-playlist',
        '--no-download',
        '--quiet',
        '--no-warnings',
      ], { timeout: 20_000 });

      const results: SearchResult[] = stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const r = JSON.parse(line) as YtSearchResult;
          const videoId = r.id ?? '';
          return {
            title: r.title ?? 'Unknown',
            artist: r.artist ?? r.uploader ?? 'Unknown',
            thumbnail: r.thumbnail ?? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            durationSec: r.duration ?? null,
            youtubeUrl: r.webpage_url ?? (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''),
          };
        })
        .filter((r) => r.youtubeUrl);

      return results;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, 'search failed');
      return reply.code(502).send({ error: msg });
    }
  });
};
