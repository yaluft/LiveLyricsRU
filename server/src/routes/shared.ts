import type { FastifyReply } from 'fastify';
import type { StreamProvider, Track } from '@lyrika/shared';

export function sendApiError(
  reply: FastifyReply,
  status: number,
  error: string,
  message: string,
  hint?: string,
) {
  return reply.code(status).send(hint ? { error, message, hint } : { error, message });
}

export function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export const RESOLVABLE: StreamProvider[] = ['youtube', 'vk', 'spotify', 'demo'];

export function isResolvable(value: string): value is StreamProvider {
  return (RESOLVABLE as string[]).includes(value);
}

/** The track the client is holding, when it is not one of ours. */
export function trackFromBody(body: Record<string, unknown>): Track | null {
  const raw = body.track;
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const provider = asString(t.provider);
  const providerId = asString(t.providerId);
  if (!providerId || !isResolvable(provider)) return null;
  return {
    id: asString(t.id, `${provider}:${providerId}`),
    title: asString(t.title, 'Без названия'),
    artist: asString(t.artist),
    durationSec: asNumber(t.durationSec),
    provider,
    providerId,
    hasSyncedLyrics: t.hasSyncedLyrics === true,
  };
}

/** Last resort: ids are minted as `provider:providerId`, so parse one back. */
export function trackFromId(trackId: string): Track | null {
  const separator = trackId.indexOf(':');
  if (separator <= 0) return null;
  const provider = trackId.slice(0, separator);
  const providerId = trackId.slice(separator + 1);
  if (!providerId || !isResolvable(provider)) return null;
  return {
    id: trackId,
    title: 'Без названия',
    artist: '',
    durationSec: 0,
    provider,
    providerId,
    hasSyncedLyrics: false,
  };
}
