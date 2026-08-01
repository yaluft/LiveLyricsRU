/**
 * Reading-aid romanisation, not a standard (GOST/ISO) transliteration: it spells
 * out the iotated vowels (е → ye, я → ya) so a learner reads the sound rather
 * than the letter. Matches the pronunciation row in the Лирика design.
 */
const MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'ye',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '"',
  ы: 'y',
  ь: "'",
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function transliterate(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase()) {
    out += MAP[ch] ?? ch;
  }
  return out;
}

const WORD_RE = /[\p{L}\p{M}'’-]+/gu;

export function splitWords(line: string): { text: string; index: number }[] {
  const out: { text: string; index: number }[] = [];
  for (const m of line.matchAll(WORD_RE)) {
    if (m.index === undefined) continue;
    out.push({ text: m[0], index: m.index });
  }
  return out;
}

/** Strips punctuation and case so a surface form can be looked up in the glossary. */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{M}-]/gu, '');
}
