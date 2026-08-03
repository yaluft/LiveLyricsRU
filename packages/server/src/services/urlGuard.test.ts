import { describe, expect, it } from 'vitest';
import { checkMediaUrl, looksLikeUrl } from './urlGuard.js';

function reason(url: string): string {
  const result = checkMediaUrl(url);
  return result.ok ? '<accepted>' : result.reason;
}

describe('checkMediaUrl — accepts', () => {
  it('YouTube in its various hostnames', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=abc123',
      'https://youtube.com/watch?v=abc123',
      'https://youtu.be/abc123',
      'https://music.youtube.com/watch?v=abc123',
      'https://www.youtube-nocookie.com/embed/abc123',
    ]) {
      const result = checkMediaUrl(url);
      expect(result.ok, url).toBe(true);
      if (result.ok) expect(result.provider).toBe('youtube');
    }
  });

  it('VK', () => {
    for (const url of ['https://vk.com/video-1_2', 'https://vkvideo.ru/video-1_2']) {
      const result = checkMediaUrl(url);
      expect(result.ok, url).toBe(true);
      if (result.ok) expect(result.provider).toBe('vk');
    }
  });

  it('normalises a trailing-dot FQDN rather than rejecting it', () => {
    const result = checkMediaUrl('https://www.youtube.com./watch?v=abc');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.host).toBe('www.youtube.com');
  });

  it('is case-insensitive about the host', () => {
    expect(checkMediaUrl('https://WWW.YouTube.COM/watch?v=abc').ok).toBe(true);
  });
});

describe('checkMediaUrl — SSRF defences', () => {
  it('refuses non-HTTP protocols', () => {
    for (const url of [
      'file:///etc/passwd',
      'gopher://youtube.com/',
      'ftp://youtube.com/x',
      'javascript:alert(1)',
    ]) {
      expect(checkMediaUrl(url).ok, url).toBe(false);
    }
  });

  it('refuses IPv4 literals, including the cloud metadata address', () => {
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:8787/api/health',
      'http://10.0.0.5/',
      'http://192.168.1.1/',
    ]) {
      expect(reason(url), url).toBe('Ссылки на IP-адреса не принимаются');
    }
  });

  it('refuses bracketed IPv6 literals', () => {
    expect(reason('http://[::1]/')).toBe('Ссылки на IP-адреса не принимаются');
    expect(reason('http://[fd00::1]/')).toBe('Ссылки на IP-адреса не принимаются');
  });

  it('refuses embedded credentials', () => {
    // Reads as YouTube to a human; resolves to evil.example.
    expect(reason('https://youtube.com@evil.example/')).toBe(
      'Ссылки с учётными данными не принимаются',
    );
    expect(checkMediaUrl('https://user:pass@www.youtube.com/watch?v=a').ok).toBe(false);
  });

  it('refuses suffix lookalikes', () => {
    for (const url of [
      'https://youtube.com.evil.example/watch?v=a',
      'https://notyoutube.com/watch?v=a',
      'https://evil-youtube.com/watch?v=a',
      'https://vk.com.attacker.test/video',
    ]) {
      expect(checkMediaUrl(url).ok, url).toBe(false);
    }
  });

  it('refuses an unparseable or empty value', () => {
    expect(reason('')).toBe('Пустая ссылка');
    expect(reason('   ')).toBe('Пустая ссылка');
    expect(reason('not a url')).toBe('Не похоже на ссылку');
  });

  it('refuses an absurdly long URL before doing any work', () => {
    expect(reason(`https://youtube.com/watch?v=${'a'.repeat(4000)}`)).toBe(
      'Ссылка слишком длинная',
    );
  });
});

describe('checkMediaUrl — recognised but unsupported', () => {
  it('explains Spotify rather than saying "not allowlisted"', () => {
    const result = checkMediaUrl('https://open.spotify.com/track/abc');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('30-секундные превью');
      expect(result.hint).toBeTruthy();
    }
  });

  it('explains Apple Music', () => {
    const result = checkMediaUrl('https://music.apple.com/us/album/x/1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Apple Music');
  });

  it('offers upload as the way out for an unknown host', () => {
    const result = checkMediaUrl('https://example.com/song.mp3');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hint).toContain('загрузите файл');
  });
});

describe('looksLikeUrl', () => {
  it('recognises http and https, ignoring surrounding space', () => {
    expect(looksLikeUrl('  https://youtube.com/x ')).toBe(true);
    expect(looksLikeUrl('HTTP://youtube.com/x')).toBe(true);
  });

  it('treats a search term as a term', () => {
    expect(looksLikeUrl('земфира искала')).toBe(false);
    expect(looksLikeUrl('youtube.com/watch')).toBe(false);
  });
});
