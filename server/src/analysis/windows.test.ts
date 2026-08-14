import { expect, test } from 'vitest'
import { WINDOWS, DEFAULT_WINDOW, bucketIndex, buildGrid, isTimeWindow } from './windows.js'

const NOW = Date.parse('2026-08-13T12:00:00.000Z')
const MS_PER_DAY = 86_400_000

test('the windows are the four from the spec and the default one is 12m', () => {
  expect(WINDOWS).toEqual(['30d', '90d', '12m', 'all'])
  expect(DEFAULT_WINDOW).toBe('12m')
})

test('isTimeWindow only accepts the four windows', () => {
  expect(isTimeWindow('30d')).toBe(true)
  expect(isTimeWindow('all')).toBe(true)
  expect(isTimeWindow('7d')).toBe(false)
})

test('30d is 30 one-day buckets ending at now', () => {
  const grid = buildGrid('30d', NOW, [])

  expect(grid.bucket).toBe('day')
  expect(grid.starts).toHaveLength(30)
  expect(grid.end).toBe(NOW)
  expect(grid.starts[0]).toBe(NOW - 30 * MS_PER_DAY)
  expect(grid.starts[29]).toBe(NOW - MS_PER_DAY)
})

test('90d is 13 weekly buckets and 12m is 52', () => {
  expect(buildGrid('90d', NOW, []).bucket).toBe('week')
  expect(buildGrid('90d', NOW, []).starts).toHaveLength(13)
  expect(buildGrid('12m', NOW, []).bucket).toBe('week')
  expect(buildGrid('12m', NOW, []).starts).toHaveLength(52)
})

test('the previous window is equally long and ends where the current one starts', () => {
  const grid = buildGrid('12m', NOW, [])
  const previous = grid.previous

  expect(previous?.starts).toHaveLength(52)
  expect(previous?.end).toBe(grid.starts[0])
  expect(previous?.previous).toBeNull()
})

test('all runs from the month of the first commit to the month of now and has nothing to compare against', () => {
  const grid = buildGrid('all', NOW, [
    Date.parse('2026-07-01T00:00:00.000Z'),
    Date.parse('2026-06-15T00:00:00.000Z'),
  ])

  expect(grid.bucket).toBe('month')
  expect(grid.previous).toBeNull()
  expect(grid.starts.map((ms) => new Date(ms).toISOString())).toEqual([
    '2026-06-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z',
    '2026-08-01T00:00:00.000Z',
  ])
  expect(new Date(grid.end).toISOString()).toBe('2026-09-01T00:00:00.000Z')
})

test('all without commits has no buckets at all', () => {
  expect(buildGrid('all', NOW, []).starts).toEqual([])
})

test('a bucket includes its start and the window excludes its end', () => {
  const grid = buildGrid('30d', NOW, [])

  expect(bucketIndex(grid, NOW)).toBeNull()
  expect(bucketIndex(grid, NOW - 1)).toBe(29)
  expect(bucketIndex(grid, NOW - 30 * MS_PER_DAY)).toBe(0)
  expect(bucketIndex(grid, NOW - 30 * MS_PER_DAY - 1)).toBeNull()
})
