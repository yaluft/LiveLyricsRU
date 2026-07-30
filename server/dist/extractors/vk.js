import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
function cleanUploader(raw) {
    return raw.replace(/\s*-\s*Topic\s*$/i, '').trim();
}
async function ytdlpJson(url) {
    const { stdout } = await execFileAsync('python3', [
        '-m', 'yt_dlp', '--dump-json', '--no-playlist', '--quiet', url,
    ], { timeout: 30_000 });
    return JSON.parse(stdout.trim());
}
async function ytdlpGetUrl(url) {
    const { stdout } = await execFileAsync('python3', [
        '-m', 'yt_dlp', '--format', 'bestaudio/best', '--get-url',
        '--no-playlist', '--quiet', url,
    ], { timeout: 30_000 });
    const streamUrl = stdout.trim().split('\n')[0];
    if (!streamUrl)
        throw new Error('yt-dlp returned no URL for VK');
    return streamUrl;
}
export async function extractVk(url) {
    const [meta, streamUrl] = await Promise.all([
        ytdlpJson(url),
        ytdlpGetUrl(url),
    ]);
    const artist = meta.artist ?? meta.creator
        ?? (meta.uploader ? cleanUploader(meta.uploader) : 'Unknown');
    const title = meta.track ?? meta.title ?? 'Unknown';
    return {
        streamUrl,
        title,
        artist,
        thumbnail: meta.thumbnail ?? '',
        durationSec: meta.duration ?? null,
        source: 'vk',
    };
}
//# sourceMappingURL=vk.js.map