import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
// Find yt-dlp binary — support pip user install and system install
const YTDLP = (() => {
    const candidates = [
        process.env.YTDLP_PATH,
        `${process.env.HOME}/.local/bin/yt-dlp`,
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp',
    ].filter(Boolean);
    return candidates[0]; // resolved lazily at call time
})();
/** Strip YouTube auto-generated " - Topic" suffix from uploader names */
function cleanUploader(raw) {
    return raw.replace(/\s*-\s*Topic\s*$/i, '').trim();
}
async function ytdlpJson(url) {
    const { stdout } = await execFileAsync('python3', [
        '-m', 'yt_dlp', '--dump-json', '--no-playlist',
        '--quiet', url,
    ], { timeout: 30_000 });
    return JSON.parse(stdout.trim());
}
async function ytdlpGetUrl(url) {
    const { stdout } = await execFileAsync('python3', [
        '-m', 'yt_dlp',
        '--format', 'bestaudio/best',
        '--get-url',
        '--no-playlist',
        '--quiet',
        url,
    ], { timeout: 30_000 });
    const lines = stdout.trim().split('\n').filter(Boolean);
    const streamUrl = lines[0];
    if (!streamUrl)
        throw new Error('yt-dlp returned no URL');
    return streamUrl;
}
export async function extractYoutube(url) {
    const [meta, streamUrl] = await Promise.all([
        ytdlpJson(url),
        ytdlpGetUrl(url),
    ]);
    // Prefer dedicated music fields; fall back to cleaned uploader
    const artist = meta.artist ?? meta.creator
        ?? (meta.uploader ? cleanUploader(meta.uploader) : 'Unknown');
    // Prefer dedicated track field over full video title
    const title = meta.track ?? meta.title ?? 'Unknown';
    return {
        streamUrl,
        title,
        artist,
        thumbnail: meta.thumbnail ?? '',
        durationSec: meta.duration ?? null,
        source: 'youtube',
    };
}
//# sourceMappingURL=youtube.js.map