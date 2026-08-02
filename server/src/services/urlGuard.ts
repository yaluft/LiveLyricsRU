import type { StreamProvider } from '@lyrika/shared';

/**
 * Hosts we are willing to hand to the resolver. Everything else is rejected
 * before any network or subprocess work happens, which is what keeps a pasted
 * "media URL" from becoming an SSRF probe into the deployment's own network.
 */
const ALLOWED_HOSTS: { suffix: string; provider: StreamProvider }[] = [
  { suffix: 'youtube.com', provider: 'youtube' },
  { suffix: 'youtu.be', provider: 'youtube' },
  { suffix: 'youtube-nocookie.com', provider: 'youtube' },
  { suffix: 'vk.com', provider: 'vk' },
  { suffix: 'vkvideo.ru', provider: 'vk' },
  // Covers open.spotify.com, api.spotify.com and accounts.spotify.com.
  { suffix: 'spotify.com', provider: 'spotify' },
  // Deezer is a metadata-only import source: playlist entries are re-matched
  // against a real playable provider, so nothing here is ever streamed.
  { suffix: 'deezer.com', provider: 'demo' },
  { suffix: 'api.deezer.com', provider: 'demo' },
];

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export interface UrlCheckOk {
  ok: true;
  url: string;
  provider: StreamProvider;
  host: string;
}

export interface UrlCheckErr {
  ok: false;
  reason: string;
}

export type UrlCheck = UrlCheckOk | UrlCheckErr;

function isIpLiteral(hostname: string): boolean {
  // URL() wraps IPv6 literals in brackets; IPv4 is bare dotted-quad.
  return hostname.startsWith('[') || IPV4_RE.test(hostname);
}

export function checkMediaUrl(raw: string): UrlCheck {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'Пустая ссылка' };
  if (trimmed.length > 2048) return { ok: false, reason: 'Ссылка слишком длинная' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'Не похоже на ссылку' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: `Протокол ${parsed.protocol} не поддерживается` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Ссылки с учётными данными не принимаются' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (isIpLiteral(hostname)) {
    return { ok: false, reason: 'Ссылки на IP-адреса не принимаются' };
  }

  const match = ALLOWED_HOSTS.find(
    (entry) => hostname === entry.suffix || hostname.endsWith(`.${entry.suffix}`),
  );
  if (!match) {
    return {
      ok: false,
      reason: `Хост ${hostname} не в списке разрешённых (YouTube, VK, Spotify, Deezer)`,
    };
  }

  return { ok: true, url: parsed.toString(), provider: match.provider, host: hostname };
}

export function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
