import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractPlainLyrics, extractSubtitle, extractToken } from './musixmatch.js';

// Placeholder lyric text only — never real song lyrics.
const LRC_BODY = '[00:00.00] la la la\n[00:03.50] na na na\n';
const PLAIN_BODY = 'la la la\nna na na\n';

function tokenResponse(token: string, status = 200): unknown {
  return { message: { header: { status_code: status }, body: { user_token: token } } };
}

function macroResponse(opts: { subtitle?: string; plain?: string }): unknown {
  const macro_calls: Record<string, unknown> = {};
  if (opts.subtitle !== undefined) {
    macro_calls['track.subtitles.get'] = {
      message: { body: { subtitle_list: [{ subtitle: { subtitle_body: opts.subtitle } }] } },
    };
  }
  if (opts.plain !== undefined) {
    macro_calls['track.lyrics.get'] = {
      message: { body: { lyrics: { lyrics_body: opts.plain } } },
    };
  }
  return { message: { header: { status_code: 200 }, body: { macro_calls } } };
}

test('extractToken reads a valid token', () => {
  assert.equal(extractToken(tokenResponse('abcdef1234567890')), 'abcdef1234567890');
});

test('extractToken rejects a non-200 status', () => {
  assert.equal(extractToken(tokenResponse('abcdef1234567890', 401)), null);
});

test('extractToken rejects the UpgradeOnly sentinel', () => {
  assert.equal(extractToken(tokenResponse('UpgradeOnlyUpgradeOnly')), null);
});

test('extractToken rejects a too-short token', () => {
  assert.equal(extractToken(tokenResponse('short')), null);
});

test('extractToken tolerates a malformed body', () => {
  assert.equal(extractToken({}), null);
  assert.equal(extractToken(null), null);
  assert.equal(extractToken({ message: { header: {} } }), null);
});

test('extractSubtitle pulls the LRC body out of the macro nesting', () => {
  assert.equal(extractSubtitle(macroResponse({ subtitle: LRC_BODY })), LRC_BODY);
});

test('extractSubtitle returns null when the subtitle body is empty', () => {
  assert.equal(extractSubtitle(macroResponse({ subtitle: '   ' })), null);
});

test('extractSubtitle returns null when the macro path is absent', () => {
  assert.equal(extractSubtitle(macroResponse({ plain: PLAIN_BODY })), null);
  assert.equal(extractSubtitle({}), null);
});

test('extractPlainLyrics pulls the unsynced body out', () => {
  assert.equal(extractPlainLyrics(macroResponse({ plain: PLAIN_BODY })), PLAIN_BODY);
});

test('extractPlainLyrics returns null when absent or empty', () => {
  assert.equal(extractPlainLyrics(macroResponse({ subtitle: LRC_BODY })), null);
  assert.equal(extractPlainLyrics(macroResponse({ plain: '' })), null);
});
