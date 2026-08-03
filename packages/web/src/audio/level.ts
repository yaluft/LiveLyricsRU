/**
 * A mutable box holding the current audio level, 0–1.
 *
 * Deliberately outside the reactive system. The engine writes it every frame
 * and the ocean's render loop reads it every frame — routing a 60 Hz signal
 * through signals would schedule sixty updates a second for a value only one
 * consumer cares about, and that consumer is not rendering DOM.
 *
 * Do not make this a signal.
 */
export const audioLevel = { value: 0 };
