/**
 * Auto-scroll ring around the "next" button: when it is on and how much of the
 * circumference the arc covers. The maths lives here so it can be tested
 * without a DOM.
 *
 * @typedef {{ progress: number, paused: boolean }} RingState
 */

/** Circumference of the ring (r = 21), matches stroke-dasharray in the CSS. */
export const RING_LENGTH = 2 * Math.PI * 21;

/**
 * The ring tracks a running countdown only: a paused or stopped one would
 * leave a frozen or empty circle around the button, which reads as a broken
 * control rather than a state.
 * @param {RingState | null} state
 */
export function ringVisible(state) {
  return Boolean(state) && !state.paused;
}

/**
 * `stroke-dashoffset` for the arc: the full circumference at 0, nothing at 1.
 * @param {number} progress
 */
export function ringOffset(progress) {
  return RING_LENGTH * (1 - progress);
}
