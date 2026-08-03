import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const run = promisify(execFile);

let probe: Promise<boolean> | undefined;

/**
 * Whether `yt-dlp` is on PATH. Memoised — this is checked on every health
 * request and spawning a process each time would be silly.
 *
 * Absence is a supported state, not an error: search and URL resolution become
 * unavailable and upload remains the working path.
 */
export function ytDlpAvailable(): Promise<boolean> {
  probe ??= run(config.ytDlpPath, ['--version'], {
    timeout: 5_000,
    // Minimal environment: the subprocess has no reason to inherit anything else.
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
  })
    .then(() => true)
    .catch(() => false);

  return probe;
}

/** Test seam — clears the memoised probe. */
export function resetYtDlpProbe(): void {
  probe = undefined;
}
