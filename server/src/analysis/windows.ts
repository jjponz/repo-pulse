import type { BucketSize, TimeWindow } from './types.js'

const MS_PER_DAY = 86_400_000

interface FixedWindow {
  bucket: BucketSize
  buckets: number
  days: number
}

/**
 * A window's length is number of buckets × bucket size (30, 91 and 364 days), so
 * that the previous window is exactly as long.
 */
const FIXED_WINDOWS: Record<'30d' | '90d' | '12m', FixedWindow> = {
  '30d': { bucket: 'day', buckets: 30, days: 1 },
  '90d': { bucket: 'week', buckets: 13, days: 7 },
  '12m': { bucket: 'week', buckets: 52, days: 7 },
}

export const WINDOWS: readonly TimeWindow[] = ['30d', '90d', '12m', 'all']

export const DEFAULT_WINDOW: TimeWindow = '12m'

export function isTimeWindow(value: string): value is TimeWindow {
  return (WINDOWS as readonly string[]).includes(value)
}

/** Bucket grid: bucket `i` covers [starts[i], starts[i + 1]) and the last one ends at `end`. */
export interface Grid {
  bucket: BucketSize
  /** start of each bucket in epoch ms, ascending */
  starts: number[]
  /** EXCLUSIVE end of the window in epoch ms */
  end: number
  /** equally long previous window; null when there is nothing to compare against (`all`) */
  previous: Grid | null
}

export function buildGrid(
  window: TimeWindow,
  now: number,
  dates: readonly number[],
): Grid {
  if (window === 'all') return monthlyGrid(now, dates)
  const definition = FIXED_WINDOWS[window]
  const current = fixedGrid(definition, now)
  const currentStart = current.starts[0] ?? now
  return { ...current, previous: fixedGrid(definition, currentStart) }
}

/** Index of the bucket `date` falls into, or null when it lands outside the window. */
export function bucketIndex(grid: Grid, date: number): number | null {
  if (date >= grid.end) return null
  for (let i = grid.starts.length - 1; i >= 0; i--) {
    const start = grid.starts[i]
    if (start !== undefined && date >= start) return i
  }
  return null
}

function fixedGrid(definition: FixedWindow, end: number): Grid {
  const length = definition.days * MS_PER_DAY
  const starts: number[] = []
  for (let i = definition.buckets; i > 0; i--) starts.push(end - i * length)
  return { bucket: definition.bucket, starts, end, previous: null }
}

/**
 * `all` runs from the month of the first commit to the month of the last commit
 * or of `now` (whichever is later), inclusive: that way not a single commit is
 * lost. It has nothing to compare against.
 */
function monthlyGrid(now: number, dates: readonly number[]): Grid {
  const first = dates[0]
  if (first === undefined) {
    return { bucket: 'month', starts: [], end: addMonths(startOfMonth(now), 1), previous: null }
  }
  let oldest = first
  let newest = first
  for (const date of dates) {
    if (date < oldest) oldest = date
    if (date > newest) newest = date
  }
  const firstMonth = startOfMonth(oldest)
  const lastMonth = startOfMonth(Math.max(newest, now))
  const starts: number[] = []
  for (let i = 0; i <= monthsBetween(firstMonth, lastMonth); i++) {
    starts.push(addMonths(firstMonth, i))
  }
  return { bucket: 'month', starts, end: addMonths(lastMonth, 1), previous: null }
}

function startOfMonth(ms: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
}

function addMonths(ms: number, months: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
}

function monthsBetween(from: number, to: number): number {
  const a = new Date(from)
  const b = new Date(to)
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
}
