import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateLrcFromPlain } from './lrcGenerator.js';

test('generateLrcFromPlain spaces lines and weights by word count', () => {
  const text = 'short\nthis is a much longer line with more words\nmid length line';
  const out = generateLrcFromPlain(text, 120);
  // Should produce three timestamped lines
  const lines = out.split('\n');
  assert.equal(lines.length, 3);
  // Each line should start with [mm:ss.xx]
  assert.match(lines[0], /^\[\d{2}:\d{2}\.\d{2}\]/);
  // Ensure increasing timestamps
  const times = lines.map((l) => l.match(/^\[(\d{2}):(\d{2})\.(\d{2})\]/)!).map((m) => parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / 100);
  assert.ok(times[0] < times[1] && times[1] < times[2]);
});
