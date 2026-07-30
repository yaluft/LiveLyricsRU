import { extractYoutube } from './youtube.js';
import { extractVk } from './vk.js';
import { extractSpotify } from './spotify.js';
export function detectPlatform(url) {
    if (/youtube\.com|youtu\.be/.test(url))
        return 'youtube';
    if (/vk\.com/.test(url))
        return 'vk';
    if (/spotify\.com/.test(url))
        return 'spotify';
    return 'direct';
}
export async function extract(url) {
    const platform = detectPlatform(url);
    switch (platform) {
        case 'youtube':
            return extractYoutube(url);
        case 'vk':
            return extractVk(url);
        case 'spotify':
            return extractSpotify(url);
        case 'direct':
            // Direct URL — return it as-is, no metadata extraction
            return {
                streamUrl: url,
                title: decodeURIComponent(url.split('/').pop() ?? 'Track').replace(/\.[^.]+$/, ''),
                artist: '',
                thumbnail: '',
                durationSec: null,
                source: 'direct',
            };
    }
}
//# sourceMappingURL=index.js.map