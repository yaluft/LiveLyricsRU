import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
const QuerySchema = z.object({
    artist: z.string().min(1),
    title: z.string().default(''),
});
export const relatedRoute = async (app) => {
    app.get('/related', async (request, reply) => {
        const parsed = QuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Missing required param: artist' });
        }
        const { artist, title } = parsed.data;
        // Search for more songs by the same artist
        const query = title
            ? `${artist} songs playlist` // artist discography
            : `${artist} best songs`;
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
            const results = stdout
                .trim()
                .split('\n')
                .filter(Boolean)
                .map((line) => {
                const r = JSON.parse(line);
                const videoId = r.id ?? '';
                return {
                    title: r.title ?? 'Unknown',
                    artist: r.artist ?? r.uploader?.replace(/\s*-\s*Topic\s*$/i, '').trim() ?? 'Unknown',
                    thumbnail: r.thumbnail ?? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                    durationSec: r.duration ?? null,
                    youtubeUrl: r.webpage_url ?? (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''),
                };
            })
                .filter((r) => r.youtubeUrl);
            return results;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            app.log.error({ err }, 'related failed');
            return reply.code(502).send({ error: msg });
        }
    });
};
//# sourceMappingURL=related.js.map