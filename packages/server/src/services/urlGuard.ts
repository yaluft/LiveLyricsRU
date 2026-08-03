import type { StreamProvider } from '@lyrika/core';

/**
 * Hosts we are willing to hand to the resolver.
 *
 * This check runs before any network call and before any subprocess, which is
 * what stops a pasted "media URL" from becoming an SSRF probe into whatever the
 * deployment can reach — a cloud metadata endpoint, an internal admin service,
 * a database on a private subnet.
 */
const ALLOWED: readonly { suffix: string; provider: Exclude<StreamProvider, 'upload'> }[] = [
  { suffix: 'youtube.com', provider: 'youtube' },
  { suffix: 'youtu.be', provider: 'youtube' },
  { suffix: 'youtube-nocookie.com', provider: 'youtube' },
  { suffix: 'vk.com', provider: 'vk' },
  { suffix: 'vkvideo.ru', provider: 'vk' },
];

/**
 * Recognised but not resolvable. Kept separate from the allowlist so the user
 * gets "Spotify only serves 30-second previews" instead of the generic
 * "not in the allowlist", which reads like a bug rather than a limitation.
 */
const KNOWN_UNSUPPORTED: readonly { suffix: string; reason: string; hint: string }[] = [
  {
    suffix: 'spotify.com',
    reason: 'Spotify отдаёт только 30-секундные превью',
    hint: 'Попробуйте вариант с YouTube.',
  },
  {
    suffix: 'music.apple.com',
    reason: 'Apple Music не отдаёт аудиопоток',
    hint: 'Попробуйте вариант с YouTube.',
  },
];

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const MAX_URL_LENGTH = 2048;

export type UrlCheck =
  | { ok: true; url: string; provider: Exclude<StreamProvider, 'upload'>; host: string }
  | { ok: false; reason: string; hint?: string };

function isIpLiteral(hostname: string): boolean {
  // URL() wraps IPv6 literals in brackets; IPv4 arrives as a bare dotted quad.
  // Both are refused outright: a hostname allowlist is meaningless if a caller
  // can simply skip DNS and address an internal host numerically.
  return hostname.startsWith('[') || IPV4.test(hostname);
}

/** True when `host` is exactly `suffix` or a subdomain of it — never a lookalike. */
function hostMatches(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

export function checkMediaUrl(raw: string): UrlCheck {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'Пустая ссылка' };
  if (trimmed.length > MAX_URL_LENGTH) return { ok: false, reason: 'Ссылка слишком длинная' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'Не похоже на ссылку' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    // Blocks file:, data:, gopher:, and anything else a resolver might follow.
    return { ok: false, reason: `Протокол ${parsed.protocol} не поддерживается` };
  }

  if (parsed.username || parsed.password) {
    // `https://youtube.com@evil.example/` reads as YouTube to a human but
    // resolves to evil.example. Refusing credentials removes the ambiguity.
    return { ok: false, reason: 'Ссылки с учётными данными не принимаются' };
  }

  // A trailing dot is a valid FQDN form that would defeat a plain suffix match.
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');

  if (isIpLiteral(host)) {
    return { ok: false, reason: 'Ссылки на IP-адреса не принимаются' };
  }

  const unsupported = KNOWN_UNSUPPORTED.find((entry) => hostMatches(host, entry.suffix));
  if (unsupported) {
    return { ok: false, reason: unsupported.reason, hint: unsupported.hint };
  }

  const match = ALLOWED.find((entry) => hostMatches(host, entry.suffix));
  if (!match) {
    return {
      ok: false,
      reason: `Хост ${host} не в списке разрешённых`,
      hint: 'Поддерживаются YouTube и VK — или загрузите файл со своего устройства.',
    };
  }

  return { ok: true, url: parsed.toString(), provider: match.provider, host };
}

export function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
