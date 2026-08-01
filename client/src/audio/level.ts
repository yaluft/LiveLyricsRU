/**
 * Shared audio-reactivity level, 0..1. The player writes it every frame and the
 * ocean renderer reads it — deliberately outside React so a 60fps signal never
 * triggers a re-render.
 */
export const audioLevel = { value: 0 };
