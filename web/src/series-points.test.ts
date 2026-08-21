import { expect, test } from 'vitest'
import { PEOPLE_GEOMETRY, areaPoints, polylinePoints, seriesMax } from './series-points'

test('both series share one scale', () => {
  // The maximum of every series together, so the overlay is readable: the
  // previous window is drawn against the same ceiling as the current one.
  expect(seriesMax([1, 2], [4])).toBe(4)
  // The peak touches the headroom, not the edge of the viewBox.
  expect(polylinePoints([4], 4)).toBe('0.0,6.0')
  // The edge the shared scale exists for: 2 against a max of 4 is half way up,
  // not at the top, even though it is the only value of its own series.
  expect(polylinePoints([2], seriesMax([2], [4]))).not.toBe('0.0,6.0')
})

test('a zero series sits on the baseline', () => {
  expect(polylinePoints([0, 0], 1)).toBe('0.0,199.0 600.0,199.0')
})

test('the area closes on the baseline', () => {
  expect(areaPoints('0.0,6.0 600.0,199.0')).toBe('0,199 0.0,6.0 600.0,199.0 600,199')
})

test('a geometry with another baseline scales to that baseline', () => {
  // Another series, another baseline: the peak still reaches the headroom.
  expect(polylinePoints([0, 1], 1, PEOPLE_GEOMETRY)).toBe('0.0,109.0 600.0,6.0')
  // The pair pins that the default did not move.
  expect(polylinePoints([0, 1], 1)).toBe('0.0,199.0 600.0,6.0')
})
