/**
 * Shared audio-reactivity level, 0..1. The player writes it every frame and the
 * ocean renderer reads it — deliberately outside React so a 60fps signal never
 * triggers a re-render.
 */
export const audioLevel = { value: 0 };

/**
 * Frequency spectrum published alongside `audioLevel` for the music-wave
 * visualizer. `bins` holds 0..255 magnitudes low→high; `real` is false when the
 * values are synthesised (demo tracks and cross-origin streams have no usable
 * analyser). Same escape hatch as `audioLevel`: written each frame, read inside
 * the render loop, never routed through React.
 */
export const audioSpectrum = {
  bins: new Uint8Array(64),
  real: false,
};
