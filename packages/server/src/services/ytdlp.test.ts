import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const cookiesPath = { value: '' };

// config is frozen at import time, so the cookies path is stubbed rather than
// set through the environment.
vi.mock('../config.js', () => ({
  config: {
    get ytDlpCookiesPath() {
      return cookiesPath.value;
    },
    ytDlpPath: 'yt-dlp',
    ytDlpTimeoutMs: 20_000,
  },
}));

const { buildArgs, resolvedCookiesPath } = await import('./ytdlp.js');

afterEach(() => {
  cookiesPath.value = '';
});

describe('buildArgs', () => {
  it('puts every caller-supplied operand after `--`', () => {
    const args = buildArgs(['--dump-json'], ['ytsearch8:земфира']);
    const separator = args.indexOf('--');

    expect(separator).toBeGreaterThan(-1);
    expect(args.slice(separator + 1)).toEqual(['ytsearch8:земфира']);
  });

  it('keeps an operand that starts with a dash from being read as a flag', () => {
    // This is the property the `--` separator exists for: without it, a pasted
    // value like this becomes an option to yt-dlp.
    const args = buildArgs(['--dump-json'], ['--exec=rm -rf /']);
    const separator = args.indexOf('--');

    expect(args.slice(separator + 1)).toEqual(['--exec=rm -rf /']);
    // And it appears nowhere in the flag section.
    expect(args.slice(0, separator)).not.toContain('--exec=rm -rf /');
  });

  it('passes multiple operands through in order', () => {
    const args = buildArgs([], ['a', 'b', 'c']);
    expect(args.slice(args.indexOf('--') + 1)).toEqual(['a', 'b', 'c']);
  });

  it('omits the cookies flag when no path is configured', () => {
    expect(buildArgs([], ['x'])).not.toContain('--cookies');
  });

  it('includes the cookies flag when the path is a real file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lyrika-cookies-'));
    const file = join(dir, 'cookies.txt');
    writeFileSync(file, '# Netscape HTTP Cookie File\n');
    cookiesPath.value = file;

    const args = buildArgs([], ['x']);
    expect(args).toContain('--cookies');
    expect(args[args.indexOf('--cookies') + 1]).toBe(file);
  });

  it('omits the cookies flag when the path is a directory', () => {
    // Docker bind-mounting a host file that does not exist creates an empty
    // *directory* at the target. Handing yt-dlp a directory fails far
    // downstream of the actual cause, so it is caught here instead.
    const dir = mkdtempSync(join(tmpdir(), 'lyrika-cookies-'));
    const asDirectory = join(dir, 'cookies.txt');
    mkdirSync(asDirectory);
    cookiesPath.value = asDirectory;

    expect(resolvedCookiesPath()).toBeNull();
    expect(buildArgs([], ['x'])).not.toContain('--cookies');
  });

  it('omits the cookies flag when the path does not exist', () => {
    cookiesPath.value = join(tmpdir(), 'lyrika-nope', 'cookies.txt');

    expect(resolvedCookiesPath()).toBeNull();
    expect(buildArgs([], ['x'])).not.toContain('--cookies');
  });

  it('always disables playlist expansion and warnings', () => {
    const args = buildArgs([], ['x']);
    expect(args).toContain('--no-playlist');
    expect(args).toContain('--no-warnings');
  });
});
