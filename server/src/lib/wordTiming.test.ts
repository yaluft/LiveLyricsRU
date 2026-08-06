import test from 'node:test';
import assert from 'node:assert/strict';
import { computeWordOffsets } from './wordTiming.js';

test('computeWordOffsets basic properties', () => {
  const span = 10;
  const words = ['one', 'two', 'three', 'four', 'five'];
  const offsets = computeWordOffsets(words, span);
  assert.equal(offsets.length, words.length);
  for (let i = 1; i < offsets.length; i++) {
    assert.ok(offsets[i] > offsets[i - 1], 'offsets must be strictly increasing');
  }
  assert.ok(offsets[0] >= 0, 'first offset >= 0');
  assert.ok(offsets[offsets.length - 1] <= span, 'last offset <= span');
});

test('single word yields zero offset', () => {
  const offsets = computeWordOffsets(['hello'], 5);
  assert.deepEqual(offsets, [0]);
});

test('handles long and short words', () => {
  const span = 6;
  const words = ['a', 'supercalifrag', 'b', 'c'];
  const offsets = computeWordOffsets(words, span);
  assert.equal(offsets.length, words.length);
  for (let i = 1; i < offsets.length; i++) assert.ok(offsets[i] > offsets[i - 1]);
});
