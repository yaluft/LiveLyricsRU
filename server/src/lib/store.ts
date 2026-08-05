import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { config } from '../config.js';

/**
 * A tiny JSON-file store. Enough for one person's vocabulary and clips; swap
 * for a real database when the app grows past a single deployment.
 */
export class JsonStore<T> {
  #path: string;
  #fallback: T;
  #cache: T | null = null;
  #writing: Promise<void> = Promise.resolve();

  constructor(name: string, fallback: T) {
    this.#path = join(config.dataDir, `${name}.json`);
    this.#fallback = fallback;
  }

  async read(): Promise<T> {
    if (this.#cache !== null) return this.#cache;
    try {
      const raw = await readFile(this.#path, 'utf8');
      this.#cache = JSON.parse(raw) as T;
    } catch {
      this.#cache = structuredClone(this.#fallback);
    }
    return this.#cache;
  }

  async write(value: T): Promise<void> {
    this.#cache = value;
    // Serialise writes so concurrent requests can't interleave a partial file.
    this.#writing = this.#writing.then(async () => {
      await mkdir(dirname(this.#path), { recursive: true });
      const tmp = `${this.#path}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
      await rename(tmp, this.#path);
    });
    return this.#writing;
  }

  async update(fn: (current: T) => T): Promise<T> {
    const next = fn(await this.read());
    await this.write(next);
    return next;
  }
}
