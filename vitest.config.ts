import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          root: './packages/core',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'server',
          root: './packages/server',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        plugins: [solid()],
        // Solid ships separate server and browser builds; without the browser
        // condition Vitest resolves the server one and rendering silently
        // produces a string instead of DOM nodes.
        //
        // `development` is deliberately NOT listed: it resolves solid-js/store
        // to the dev build while solid-js itself stays on the production one,
        // and the dev store then calls into a debug runtime that was never
        // registered ("Cannot read properties of undefined (reading
        // 'registerGraph')").
        resolve: { conditions: ['development', 'browser'] },
        test: {
          name: 'web',
          root: './packages/web',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          // solid-js must be inlined so Vite resolves it under the same
          // conditions as solid-js/store. Left externalised, Node resolves the
          // root package without `development` (production build) while the
          // store is transformed with it (dev build), and the dev store then
          // calls a debug runtime the production build never registered.
          // @solidjs/testing-library needs it too: externalised, it imports
          // solid-js/web through Node's own resolution and gets the *server*
          // build, whose render() throws "Client-only API called on the server
          // side."
          server: { deps: { inline: [/solid-js/, /@solidjs\/testing-library/] } },
        },
      },
    ],
  },
});
