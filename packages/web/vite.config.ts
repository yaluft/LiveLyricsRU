import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8787';

export default defineConfig({
  // Tailwind v4 is a Vite plugin rather than a PostCSS step; without it the
  // `@import 'tailwindcss'` in styles.css is inert and every utility class in
  // the components silently does nothing.
  plugins: [solid(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
