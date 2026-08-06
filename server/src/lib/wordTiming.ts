export function computeWordOffsets(words: string[], span: number): number[] {
  const n = words.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  const lengths = words.map((w) => Math.max(1, w.length));
  // soften extremes
  const weights = lengths.map((l) => Math.sqrt(l));
  const total = weights.reduce((a, b) => a + b, 0);

  // small paddings so first word doesn't start at absolute 0 and last isn't flush with end
  const padStart = Math.min(0.04, span * 0.02);
  const padEnd = Math.min(0.04, span * 0.02);
  const available = Math.max(0, span - padStart - padEnd);

  const offsets: number[] = [];
  let prefix = 0;
  for (let i = 0; i < n; i++) {
    // position slightly into the word to bias toward its start
    const bias = 0.08; // fraction of word weight to shift into the word
    const posFraction = (prefix + bias * weights[i]) / total;
    const pos = padStart + posFraction * available;
    offsets.push(Number(pos.toFixed(3)));
    prefix += weights[i];
  }

  // Ensure monotonic and clamp last offset
  for (let i = 1; i < offsets.length; i++) {
    if (offsets[i] <= offsets[i - 1] + 0.001) offsets[i] = offsets[i - 1] + 0.005;
  }
  const lastMax = Math.max(0, span - padEnd);
  if (offsets[offsets.length - 1] > lastMax) {
    const shift = offsets[offsets.length - 1] - lastMax;
    // shift all offsets back proportionally
    for (let i = 0; i < offsets.length; i++) offsets[i] = Math.max(0, offsets[i] - shift);
  }

  return offsets;
}
