import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractPlainLyrics,
  extractRichsync,
  extractSubtitle,
  extractToken,
  richsyncToLyricLines,
} from './musixmatch.js';

// Placeholder lyric text only — never real song lyrics.
const LRC_BODY = '[00:00.00] la la la\n[00:03.50] na na na\n';
const PLAIN_BODY = 'la la la\nna na na\n';

function tokenResponse(token: string, status = 200): unknown {
  return { message: { header: { status_code: status }, body: { user_token: token } } };
}

function macroResponse(opts: { subtitle?: string; plain?: string; richsync?: string }): unknown {
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
  if (opts.richsync !== undefined) {
    macro_calls['track.richsync.get'] = {
      message: { body: { richsync: { richsync_body: opts.richsync } } },
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

const RICHSYNC_BODY = JSON.stringify([
  {
    ts: 12.5,
    te: 15.2,
    x: 'la la la',
    l: [
      { c: 'la', o: 0 },
      { c: ' ', o: 0.3 },
      { c: 'la', o: 0.5 },
      { c: ' ', o: 0.8 },
      { c: 'la', o: 1.1 },
    ],
  },
  {
    ts: 18.0,
    te: 21.0,
    x: 'na na na',
    l: [
      { c: 'na', o: 0 },
      { c: 'na', o: 0.6 },
      { c: 'na', o: 1.2 },
    ],
  },
]);

test('extractRichsync pulls and parses the richsync body out of the macro nesting', () => {
  const richsync = extractRichsync(macroResponse({ richsync: RICHSYNC_BODY }));
  assert.equal(Array.isArray(richsync), true);
  assert.equal(richsync?.length, 2);
});

test('extractRichsync returns null when the macro path is absent', () => {
  assert.equal(extractRichsync(macroResponse({ subtitle: LRC_BODY })), null);
  assert.equal(extractRichsync({}), null);
});

test('extractRichsync returns null on unparseable or non-array JSON', () => {
  assert.equal(extractRichsync(macroResponse({ richsync: 'not json' })), null);
  assert.equal(extractRichsync(macroResponse({ richsync: '{}' })), null);
  assert.equal(extractRichsync(macroResponse({ richsync: '[]' })), null);
});

test('richsyncToLyricLines uses real per-word offsets when chunk count matches the tokenizer', () => {
  const richsync = extractRichsync(macroResponse({ richsync: RICHSYNC_BODY }));
  assert.ok(richsync);
  const lines = richsyncToLyricLines(richsync, 240);
  assert.equal(lines.length, 2);

  assert.equal(lines[0]?.time, 12.5);
  assert.equal(lines[0]?.end, 15.2);
  assert.equal(lines[0]?.text, 'la la la');
  assert.deepEqual(
    lines[0]?.words.map((w) => w.offset),
    [0, 0.5, 1.1],
  );

  assert.equal(lines[1]?.time, 18);
  assert.equal(lines[1]?.end, 21);
  assert.deepEqual(
    lines[1]?.words.map((w) => w.offset),
    [0, 0.6, 1.2],
  );
});

test('richsyncToLyricLines falls back to an even split when chunk count does not match tokens', () => {
  const mismatched = JSON.stringify([
    { ts: 1, te: 5, x: 'one two three four', l: [{ c: 'onechunk', o: 0 }] },
  ]);
  const richsync = extractRichsync(macroResponse({ richsync: mismatched }));
  assert.ok(richsync);
  const lines = richsyncToLyricLines(richsync, 240);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.words.length, 4);
  // even split over a 4s span across 4 words: 0, 1, 2, 3
  assert.deepEqual(
    lines[0]?.words.map((w) => w.offset),
    [0, 1, 2, 3],
  );
});

test('richsyncToLyricLines sorts out-of-order entries and derives end from the next line when te is missing', () => {
  const unordered = JSON.stringify([
    { ts: 10, x: 'second line', l: [{ c: 'second', o: 0 }, { c: 'line', o: 0.4 }] },
    { ts: 2, te: 5, x: 'first line', l: [{ c: 'first', o: 0 }, { c: 'line', o: 0.4 }] },
  ]);
  const richsync = extractRichsync(macroResponse({ richsync: unordered }));
  assert.ok(richsync);
  const lines = richsyncToLyricLines(richsync, 240);
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.text, 'first line');
  assert.equal(lines[0]?.end, 5); // from its own te
  assert.equal(lines[1]?.text, 'second line');
  assert.equal(lines[1]?.end, 240); // last line, no te: falls back to total duration
});
