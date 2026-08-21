/**
 * The arithmetic of the line charts, kept out of the components so it can be
 * pinned with exact strings instead of read off a rendered DOM. Pure: numbers
 * in, SVG `points` attributes out, in the user units of the viewBox the given
 * geometry describes.
 */

/** The box one series is drawn in: how wide, where the floor and the ceiling are. */
export interface SeriesGeometry {
  /** Width of the viewBox: the last sample sits exactly on it. */
  width: number
  /** The y of the baseline, one unit above the bottom so the stroke is not cut. */
  baseline: number
  /** The y the tallest sample reaches: never the very edge of the viewBox. */
  headroom: number
}

/** The pulse chart: a `0 0 600 200` viewBox. */
export const PULSE_GEOMETRY: SeriesGeometry = { width: 600, baseline: 199, headroom: 6 }

/** The people chart: the same width over a shorter box. */
export const PEOPLE_GEOMETRY: SeriesGeometry = { width: 600, baseline: 109, headroom: 6 }

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
export function polylinePoints(
  values: readonly number[],
  max: number,
  geometry: SeriesGeometry = PULSE_GEOMETRY,
): string {
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * geometry.width
      const y = geometry.baseline - (value / max) * (geometry.baseline - geometry.headroom)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** Closes a polyline into a filled area by dropping both ends to the baseline. */
export function areaPoints(points: string, geometry: SeriesGeometry = PULSE_GEOMETRY): string {
  return `0,${geometry.baseline} ${points} ${geometry.width},${geometry.baseline}`
}
