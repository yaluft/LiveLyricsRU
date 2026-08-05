import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import path from 'node:path';

// Points at the real Fastify API (`npm run dev` from the repo root).
// Proxying — the same approach the real client/vite.config.ts uses — sidesteps
// CORS entirely rather than widening CORS_ORIGIN for a second dev port.
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      // See src/vendor/lyrika-shared.ts: this spike doesn't build the
      // monorepo's shared workspace, so the copied engine.ts/ocean.ts (which
      // import `@lyrika/shared` unmodified) resolve against a small vendored
      // stand-in instead.
      '@lyrika/shared': path.resolve(import.meta.dirname, 'src/vendor/lyrika-shared.ts'),
    },
  },
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
});
