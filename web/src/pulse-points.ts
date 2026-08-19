/**
 * The arithmetic of the pulse chart, kept out of the component so it can be
 * pinned with exact strings instead of read off a rendered DOM. Pure: numbers
 * in, SVG `points` attributes out, in the user units of a `0 0 600 200`
 * viewBox.
 */

/** Width of the viewBox: the last sample sits exactly on it. */
export const PULSE_WIDTH = 600

/** The y of the baseline, one unit above the bottom so the stroke is not cut. */
export const PULSE_BASELINE = 199

/** The y the tallest sample reaches: never the very edge of the viewBox. */
export const PULSE_HEADROOM = 6

/**
 * The ceiling both series are drawn against. Taking every series together is
 * what makes the overlay mean something: two lines on two scales could not be
 * compared by eye. Never below 1, so an all-zero window still divides.
 */
export function seriesMax(...series: readonly (readonly number[])[]): number {
  return Math.max(1, ...series.flat())
}

/**
 * The `points` of one series: samples spread evenly across the full width and
 * scaled against `max`. A single sample has no width to spread over, so it
 * sits on the left edge; an empty series draws nothing.
 */
export function polylinePoints(values: readonly number[], max: number): string {
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * PULSE_WIDTH
      const y = PULSE_BASELINE - (value / max) * (PULSE_BASELINE - PULSE_HEADROOM)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** Closes a polyline into a filled area by dropping both ends to the baseline. */
export function areaPoints(points: string): string {
  return `0,${PULSE_BASELINE} ${points} ${PULSE_WIDTH},${PULSE_BASELINE}`
}
