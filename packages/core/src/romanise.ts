/**
 * Reading-aid romanisation — deliberately not GOST/ISO. It spells out the
 * iotated vowels (е → ye, я → ya) so a learner reads the *sound* rather than
 * transliterating the letter:
 *
 *   Где свет никогда не гаснет → gdye svyet nikogda nye gasnyet
 *
 * A standards-compliant table would give "gde svet nikogda ne gasnet", which
 * reads as the wrong vowel to an English speaker. That is the whole point of
 * the pronunciation row, so the non-standard mapping is the correct one here.
 */
const LETTERS: Record<string, string> = {
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
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/**
 * The soft sign palatalises the preceding consonant rather than adding a sound,
 * and before an iotated vowel it reintroduces the glide (статья → statya, not
 * "stat'ya"). Dropping both signs entirely reads better than v2's `'` and `"`,
 * which looked like typographic noise in the pronunciation row.
 */
export function romanise(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase()) {
    out += LETTERS[ch] ?? ch;
  }
  return out;
}

const WORD_RE = /[\p{L}\p{M}'’-]+/gu;

export interface SplitWord {
  text: string;
  /** Offset into the original line, so a tap can be mapped back to the source. */
  index: number;
}

export function splitWords(line: string): SplitWord[] {
  const out: SplitWord[] = [];
  for (const match of line.matchAll(WORD_RE)) {
    if (match.index === undefined) continue;
    out.push({ text: match[0], index: match.index });
  }
  return out;
}

/** Strips punctuation and case so a surface form can be looked up as a key. */
export function normaliseWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{M}-]/gu, '');
}

/**
 * Folds ё to е for full-text search, preserving everything else.
 *
 * SQLite's `unicode61` tokeniser case-folds Cyrillic but will not do this:
 * `remove_diacritics` only strips marks from characters that decompose, and ё
 * is its own codepoint rather than е plus a combining diaeresis. Russian
 * writers treat the two as interchangeable, so both the indexed text and the
 * query have to be folded for a search of "еще" to find "ещё".
 *
 * The indexing half of this lives in the FTS5 triggers in
 * `drizzle/0001_lyric_search.sql` as a matching pair of `replace()` calls.
 * Change one and you must change the other.
 */
export function foldSearchText(text: string): string {
  return text.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
}
