import type { StreamProvider, Track } from './types.js';

const PROVIDERS: readonly StreamProvider[] = ['youtube', 'vk', 'upload'];

/**
 * Track identity is always `provider:providerId`. Search results come from the
 * resolver rather than from any local table, so a database lookup miss is the
 * normal case — the id string itself has to stay sufficient to reconstruct a
 * playable reference. Anything minting ids must keep this format.
 */
export function trackId(provider: StreamProvider, providerId: string): string {
  return `${provider}:${providerId}`;
}

/**
 * Last-resort reconstruction of a track from its id alone, for when neither the
 * database nor the client's payload has it. `providerId` may itself contain
 * colons, so only the first one is a separator.
 */
export function trackFromId(id: string): Track | null {
  const separator = id.indexOf(':');
  if (separator <= 0) return null;

  const provider = id.slice(0, separator);
  const providerId = id.slice(separator + 1);
  if (!providerId) return null;
  if (!PROVIDERS.includes(provider as StreamProvider)) return null;

  return {
    id,
    provider: provider as StreamProvider,
    providerId,
    title: providerId,
    artist: '',
    album: null,
    durationSec: 0,
    thumbUrl: null,
  };
}
