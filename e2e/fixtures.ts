/**
 * Test fixtures generated in-process rather than committed as binaries.
 *
 * The upload path is what carries this app's "works with no yt-dlp and no
 * network" guarantee — v2 leaned on a bundled demo catalogue and a virtual
 * clock for that, which meant the E2E suite exercised a parallel fake instead
 * of the real `<audio>` element and the real range-serving code. A generated
 * WAV keeps that guarantee without putting a blob in git.
 */

const SAMPLE_RATE = 8_000;

/** A mono 16-bit PCM WAV of a 440 Hz tone. Every browser decodes this. */
export function makeWav(seconds = 3): Buffer {
  const samples = SAMPLE_RATE * seconds;
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');

  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // PCM header size
  buffer.writeUInt16LE(1, 20); // format: PCM
  buffer.writeUInt16LE(1, 22); // channels
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples; i += 1) {
    const value = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 0.3 * 0x7fff;
    buffer.writeInt16LE(Math.round(value), 44 + i * 2);
  }

  return buffer;
}

/** Enhanced LRC (A2): real per-word timestamps, so `timingKind` must be 'word'. */
export const WORD_TIMED_LRC = `[ar:Тест]
[ti:Пример]
[00:00.00]<00:00.00>Где <00:00.50>свет <00:01.00>никогда
[00:01.50]<00:01.50>не <00:02.00>гаснет
`;

/** Plain LRC: line timings only, so `timingKind` must be 'line'. */
export const LINE_TIMED_LRC = `[00:00.00]Где свет никогда
[00:01.50]не гаснет
`;
