import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { createClient, type Client } from '@libsql/client';
import { normaliseWord } from '@lyrika/core';

/**
 * Builds `dictionary.db` from a Wiktionary extraction.
 *
 * Run once, offline — deliberately not part of `npm run build`. The server
 * opens the result read-only, so word lookup costs no network and no API calls
 * at runtime, and works with no connectivity at all.
 *
 *   npm run build:dictionary -- --source <url-or-path> --out ./.data/dictionary.db
 *
 * ── Licensing ─────────────────────────────────────────────────────────────
 * Wiktionary content is CC BY-SA, which is NOT this repository's MIT licence.
 * The generated database therefore must not be committed here. Ship it as a
 * release artefact or a download step, and surface the attribution in the UI.
 * This tool writes an `about` table carrying the source and licence so that
 * information travels with the file rather than living only in a README.
 */

const DEFAULT_SOURCE =
  'https://kaikki.org/dictionary/Russian/kaikki.org-dictionary-Russian.jsonl';
const LICENCE = 'CC BY-SA 4.0 — from English Wiktionary via kaikki.org (wiktextract)';

interface KaikkiSense {
  glosses?: string[];
  raw_glosses?: string[];
  tags?: string[];
}

interface KaikkiForm {
  form?: string;
  tags?: string[];
}

interface KaikkiEntry {
  word?: string;
  pos?: string;
  lang_code?: string;
  senses?: KaikkiSense[];
  forms?: KaikkiForm[];
}

interface Args {
  source: string;
  out: string;
  limit: number;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    source: get('source') ?? DEFAULT_SOURCE,
    out: get('out') ?? './.data/dictionary.db',
    limit: Number(get('limit')) || Infinity,
  };
}

async function openSource(source: string): Promise<NodeJS.ReadableStream> {
  if (!/^https?:\/\//i.test(source)) {
    const stream = createReadStream(source);
    return source.endsWith('.gz') ? stream.pipe(createGunzip()) : stream;
  }

  const response = await fetch(source);
  if (!response.ok || !response.body) {
    throw new Error(`Cannot fetch ${source}: HTTP ${response.status}`);
  }
  const stream = Readable.fromWeb(response.body);
  return source.endsWith('.gz') ? stream.pipe(createGunzip()) : stream;
}

async function createSchema(db: Client): Promise<void> {
  await db.batch(
    [
      'PRAGMA journal_mode = WAL',
      `CREATE TABLE lemmas (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         lemma TEXT NOT NULL UNIQUE
       )`,
      `CREATE TABLE senses (
         lemma_id INTEGER NOT NULL REFERENCES lemmas(id) ON DELETE CASCADE,
         idx INTEGER NOT NULL,
         pos TEXT NOT NULL DEFAULT '',
         gloss TEXT NOT NULL,
         note TEXT
       )`,
      // Many-to-one: гаснет, гаснут, гас … all point at гаснуть. This is what
      // makes tapping an inflected word in a lyric line resolve to an entry.
      `CREATE TABLE forms (
         form TEXT NOT NULL,
         lemma_id INTEGER NOT NULL REFERENCES lemmas(id) ON DELETE CASCADE,
         PRIMARY KEY (form, lemma_id)
       )`,
      `CREATE TABLE about (
         key TEXT PRIMARY KEY,
         value TEXT NOT NULL
       )`,
      'CREATE INDEX senses_lemma_idx ON senses(lemma_id)',
      'CREATE INDEX forms_form_idx ON forms(form)',
    ],
    'write',
  );
}

/** Wiktionary marks non-lemma entries; indexing them would create duplicate headwords. */
function isInflectionEntry(entry: KaikkiEntry): boolean {
  return (entry.senses ?? []).every((sense) =>
    (sense.tags ?? []).some((tag) => tag === 'form-of' || tag === 'inflection-of'),
  );
}

function glossOf(sense: KaikkiSense): string | null {
  const gloss = sense.glosses?.[0] ?? sense.raw_glosses?.[0];
  return gloss?.trim() || null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  process.stdout.write(`source: ${args.source}\nout:    ${args.out}\n`);

  await rm(args.out, { force: true });
  const db = createClient({ url: `file:${args.out}` });
  await createSchema(db);

  const lines = createInterface({
    input: await openSource(args.source),
    crlfDelay: Infinity,
  });

  let seen = 0;
  let kept = 0;
  let nextId = 1;
  const lemmaIds = new Map<string, number>();

  let lemmaRows: { sql: string; args: (string | number)[] }[] = [];

  const flush = async (): Promise<void> => {
    if (lemmaRows.length === 0) return;
    await db.batch(lemmaRows, 'write');
    lemmaRows = [];
  };

  for await (const line of lines) {
    if (!line.trim()) continue;
    if (seen >= args.limit) break;
    seen += 1;

    let entry: KaikkiEntry;
    try {
      entry = JSON.parse(line) as KaikkiEntry;
    } catch {
      continue;
    }

    if (entry.lang_code && entry.lang_code !== 'ru') continue;
    const headword = entry.word?.trim();
    if (!headword) continue;
    if (isInflectionEntry(entry)) continue;

    const glosses = (entry.senses ?? [])
      .map(glossOf)
      .filter((gloss): gloss is string => gloss !== null)
      .slice(0, 8);
    if (glosses.length === 0) continue;

    let lemmaId = lemmaIds.get(headword);
    if (lemmaId === undefined) {
      lemmaId = nextId++;
      lemmaIds.set(headword, lemmaId);
      lemmaRows.push({
        sql: 'INSERT OR IGNORE INTO lemmas (id, lemma) VALUES (?, ?)',
        args: [lemmaId, headword],
      });
    }

    glosses.forEach((gloss, idx) => {
      lemmaRows.push({
        sql: 'INSERT INTO senses (lemma_id, idx, pos, gloss) VALUES (?, ?, ?, ?)',
        args: [lemmaId, idx, entry.pos ?? '', gloss],
      });
    });

    // The headword itself is a lookup key, plus every inflected form the entry
    // lists. Both go through normaliseWord so the runtime lookup — which
    // normalises the tapped word the same way — can match them.
    const forms = new Set<string>([normaliseWord(headword)]);
    for (const form of entry.forms ?? []) {
      const value = form.form?.trim();
      if (!value || value === '-') continue;
      const key = normaliseWord(value);
      if (key) forms.add(key);
    }

    for (const form of forms) {
      lemmaRows.push({
        sql: 'INSERT OR IGNORE INTO forms (form, lemma_id) VALUES (?, ?)',
        args: [form, lemmaId],
      });
    }

    kept += 1;
    if (lemmaRows.length >= 2_000) await flush();
    if (kept % 20_000 === 0) process.stdout.write(`  ${kept} lemmas…\n`);
  }

  await flush();

  await db.batch(
    [
      { sql: 'INSERT INTO about (key, value) VALUES (?, ?)', args: ['source', args.source] },
      { sql: 'INSERT INTO about (key, value) VALUES (?, ?)', args: ['licence', LICENCE] },
      { sql: 'INSERT INTO about (key, value) VALUES (?, ?)', args: ['builtAt', new Date().toISOString()] },
      { sql: 'INSERT INTO about (key, value) VALUES (?, ?)', args: ['lemmaCount', String(kept)] },
    ],
    'write',
  );

  db.close();
  process.stdout.write(`done: ${kept} lemmas from ${seen} entries\n`);
  process.stdout.write(`licence: ${LICENCE}\n`);
  process.stdout.write('Do not commit this file — ship it as a release artefact.\n');
}

await main();
