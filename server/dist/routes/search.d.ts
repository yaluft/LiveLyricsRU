import type { FastifyPluginAsync } from 'fastify';
export interface SearchResult {
    title: string;
    artist: string;
    thumbnail: string;
    durationSec: number | null;
    youtubeUrl: string;
}
export declare const searchRoute: FastifyPluginAsync;
//# sourceMappingURL=search.d.ts.map