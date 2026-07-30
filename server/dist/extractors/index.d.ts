import type { TrackInfo } from '../types.js';
export type Platform = 'youtube' | 'vk' | 'spotify' | 'direct';
export declare function detectPlatform(url: string): Platform;
export declare function extract(url: string): Promise<TrackInfo>;
export type { TrackInfo } from '../types.js';
//# sourceMappingURL=index.d.ts.map