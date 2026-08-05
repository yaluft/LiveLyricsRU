# Frontend framework comparison — porting Lyrika's client

This is a decision-support note for a *possible future* migration off React,
written against this codebase specifically — not a general framework
comparison. It assumes the goal is **porting** the existing ~23 components /
4 Zustand stores, not rewriting the app. See `spike/solid-stage/` in this
branch for a working proof-of-concept of the SolidJS path on the Stage view.

## Why porting cost is what matters here, not runtime benchmarks

Two things make this app easier to port than a typical React app:

- `client/src/audio/engine.ts`, `client/src/audio/level.ts`, and
  `client/src/bg/ocean.ts` have **zero React imports**. They're plain
  TypeScript / vanilla three.js already, driven by their own
  `requestAnimationFrame` loops. Any target framework inherits them
  unmodified — porting cost is entirely in the ~23 components and 4 stores
  around them, not the playback/render core.
- The app already has a working pattern of **escaping the framework's
  reactivity for hot loops** (`audioLevel` as a mutable object, read outside
  React state — see CLAUDE.md's "Audio level bypasses React entirely"). A
  candidate framework that reinforces rather than fights that pattern is a
  better fit than one that's merely fast in isolation.

So the real cost driver is: how much of `client/src/components/*.tsx` and
`client/src/state/*.ts` needs re-authoring, and how mechanical is that
re-authoring per file.

## Candidates

### SolidJS — recommended

JSX stays JSX. A component like `TransportControls.tsx` ports by changing
*how state is read*, not *how markup is written* — the smallest visual diff
of the three candidates. Fine-grained signal reactivity is also a closer
conceptual match to what this app already does manually with `audioLevel`:
Solid's whole model is "update the DOM node directly, skip the re-render,"
which is the same idea CLAUDE.md documents as a deliberate escape hatch in
React. Porting to Solid stops fighting that pattern and starts being it.

**The critical gotcha:** Solid's reactivity is fine-grained through `props`
and signal *access*, not through values. Destructuring `props` at the top of
a component severs that connection — the destructured variable holds
whatever `props.x` was at the moment of the call, not a live binding, so the
component silently stops updating when the prop changes later. This is the
single most common way a naive React→Solid port introduces a subtle bug,
because it's exactly what idiomatic React code does (destructure props line
one) and it does not error — it just stops being reactive.

**Zustand:** the app's stores use `create()`, but Zustand also exports a
non-React `createStore` (`zustand/vanilla`) with `getState`/`setState`/
`subscribe` — no React dependency. A ~10-line wrapper (`createSignal` seeded
from `getState()`, updated in `subscribe()`) adapts it to Solid signals
without a dedicated integration package or a rewrite of the four stores'
logic. `spike/solid-stage/src/store.ts` doesn't use this exact wrapper (it
ports the player slice directly to `createStore` from `solid-js/store`,
since only one store was in scope) — but the same wrapper approach is what a
full migration would reach for on `library.ts` and `settings.ts`, since
`settings.ts`'s `persist` middleware and `ui.ts`'s toast queue are
easiest to keep as vanilla Zustand and merely bridge into Solid's read side.

#### Before / after: `TransportControls.tsx`

Real component, `client/src/components/TransportControls.tsx` (React):

```tsx
interface Props {
  size: 'lg' | 'md';
}

export function TransportControls({ size }: Props): JSX.Element {
  const playing = usePlayer((s) => s.playing);
  const status = usePlayer((s) => s.status);
  const toggle = usePlayer((s) => s.toggle);
  //...
  const loading = status === 'loading';
  const iconSize = size === 'lg' ? 18 : 16;

  return (
    <div className={`transport transport--${size}`}>
      {/* ... */}
    </div>
  );
}
```

**Wrong Solid port — compiles, runs, silently breaks:**

```tsx
interface Props {
  size: 'lg' | 'md';
}

export function TransportControls({ size }: Props): JSX.Element {
  //           ^^^^^^ destructured here
  const iconSize = size === 'lg' ? 18 : 16;
  //               ^^^^ reads the value captured at first render, forever

  return (
    <div class={`transport transport--${size}`}>
      {/* size is now a plain string, frozen at mount time. */}
      {/* If StageLayout ever re-passes a different `size` prop to an */}
      {/* already-mounted instance, this component will not update — */}
      {/* no error, no warning, just a stale class name and icon size. */}
    </div>
  );
}
```

**Correct Solid port** (this is what ships in `spike/solid-stage/src/TransportControls.tsx`):

```tsx
interface Props {
  size: 'lg' | 'md';
}

export function TransportControls(props: Props): JSX.Element {
  const loading = () => playerState.status === 'loading';
  const iconSize = () => (props.size === 'lg' ? 18 : 16);
  //                       ^^^^^^^^^^ accessed through props, every time

  return (
    <div class={`transport transport--${props.size}`}>
      {/* ^^^^^^^^^^ same here — props.size, not a local binding */}
    </div>
  );
}
```

The rule of thumb the team would need to adopt: **never write
`function Foo({ a, b })` in a Solid component.** Always `function Foo(props)`
and read `props.a` at the point of use (including inside JSX expressions and
memos/derived signals) so Solid's compiler can track the access.

### Svelte 5 (runes)

Smallest shipped bundle by a wide margin — Svelte compiles the reactivity
away entirely, so there's no framework runtime shipped to the client at all,
just generated imperative DOM updates. Runes (`$state`, `$derived`,
`$effect`) are a comparably ergonomic reactive primitive to Solid's signals.

The problem for *this specific port* is `.svelte` single-file components.
Markup lives in Svelte's own template syntax (`{#if}`, `{#each}`, `class:`
directives, `bind:`), not JSX — every one of the ~23 `.tsx` files would need
its JSX re-authored as Svelte template markup, not just its state-access call
sites patched. `LyricStage.tsx`'s conditional rendering
(`lyricsStatus === 'loading' ? ... : !lyrics ? ... : ...`) and its nested
`.map()` over lyric lines and words would become `{#if}/{:else if}` blocks
and `{#each}` loops — semantically equivalent, syntactically a full rewrite
of every render function in the app. That's strictly more line-level change
than Solid's "same JSX, different state-access syntax," for a bundle-size win
that mostly matters on the initial paint of a client this size, not runtime
performance.

### Vue 3 (Composition API, `<script setup>`)

The largest ecosystem and hiring pool of the three, and the most mature
tooling (Vue DevTools, Volar, a huge component-library and testing
ecosystem). `<script setup>` with the Composition API is a reasonable
conceptual match for organizing the stores' logic.

But Vue's templates (`v-if`, `v-for`, `:class`, `@click`) are the largest
syntactic departure from JSX of the three candidates — closer to Svelte's
situation than Solid's, and arguably further, since Vue also separates
`<template>`/`<script>`/`<style>` into distinct blocks rather than co-locating
markup and logic the way JSX (and Svelte, to a lesser extent) does. For a
codebase whose ~23 components are already JSX, porting to Vue is closer to a
rewrite than a port — the ecosystem and hiring advantages would need to
outweigh that migration cost on their own merits, not on "similar to what we
have."

## Summary

| | JSX compatibility | Reactivity model fits `audioLevel` pattern | Migration shape |
|---|---|---|---|
| **SolidJS** | Same JSX, different state-access syntax | Yes — fine-grained signals are the same idea, formalized | Port |
| **Svelte 5** | `.svelte` templates, full markup rewrite | Yes — runes are comparably fine-grained | Port, but heavier per-file |
| **Vue 3** | `<template>` syntax, full markup rewrite | Partial — reactive refs, but templates add indirection | Closer to rewrite |

**Recommendation: SolidJS.** It's the only candidate where the ~23 existing
`.tsx` files keep their JSX and their component shape, and where the
project's existing "escape the framework for hot loops" pattern
(`audioLevel`, `engine.ts`'s own rAF loop) is reinforced by the framework's
own reactivity model rather than sitting awkwardly next to it. The prototype
in `spike/solid-stage/` demonstrates this on the Stage view: the copied
`engine.ts`/`level.ts`/`ocean.ts` needed zero changes, and the ported
components changed only in how they read state, not in their markup.
