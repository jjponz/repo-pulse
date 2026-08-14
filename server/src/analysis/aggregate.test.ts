import { expect, test } from 'vitest'
import { aggregate, concentration, trend } from './aggregate.js'
import type { Commit } from './types.js'

const NOW = Date.parse('2026-08-13T12:00:00.000Z')

function commit(date: string, author: string, files: readonly string[] = ['src/a.ts']): Commit {
  return { sha: date, date: Date.parse(date), author, files }
}

test('concentration is the minimum number of authors adding up to 80% or more', () => {
  expect(concentration([5, 3, 1, 1])).toEqual({ authors: 2, percentage: 80 })
  expect(concentration([1, 1, 1, 1, 1])).toEqual({ authors: 4, percentage: 80 })
  expect(concentration([8, 2])).toEqual({ authors: 1, percentage: 80 })
  expect(concentration([10])).toEqual({ authors: 1, percentage: 100 })
  // These pin the threshold at exactly 80, not at "some threshold": with 4 out
  // of 5 (exactly 80%) one author already reaches it; with 79 out of 100 (79%,
  // just below) one is not enough and a second is needed.
  expect(concentration([4, 1])).toEqual({ authors: 1, percentage: 80 })
  expect(concentration([79, 21])).toEqual({ authors: 2, percentage: 100 })
})

test('without commits concentration has no authors', () => {
  expect(concentration([])).toEqual({ authors: 0, percentage: 0 })
})

test('the trend compares against the equally long previous window', () => {
  expect(trend(3, 2)).toEqual({
    comparable: true,
    percentage: 50,
    previousWindowCommits: 2,
    reason: null,
  })
  expect(trend(1, 2)).toEqual({
    comparable: true,
    percentage: -50,
    previousWindowCommits: 2,
    reason: null,
  })
})

test('without commits in the previous window the trend is not comparable', () => {
  expect(trend(5, 0)).toEqual({
    comparable: false,
    percentage: null,
    previousWindowCommits: 0,
    reason: 'no-previous-commits',
  })
})

test('without a previous window the trend is not comparable', () => {
  expect(trend(5, null)).toEqual({
    comparable: false,
    percentage: null,
    previousWindowCommits: null,
    reason: 'full-window',
  })
})

test('each bucket carries its commits and its distinct authors, and what falls outside does not count', () => {
  const commits = [
    commit('2026-08-13T09:00:00.000Z', 'ana@example.com'),
    commit('2026-08-13T10:00:00.000Z', 'bea@example.com'),
    commit('2026-08-12T09:00:00.000Z', 'ana@example.com'),
    commit('2026-06-01T09:00:00.000Z', 'cris@example.com'),
  ]

  const result = aggregate('30d', commits, NOW)

  expect(result.buckets).toHaveLength(30)
  expect(result.buckets.at(-1)).toEqual({
    start: '2026-08-12T12:00:00.000Z',
    commits: 2,
    authors: 2,
  })
  expect(result.kpis).toEqual({ commits: 3, activeAuthors: 2, filesTouched: 1 })
})

test('the touched-files KPI does not count generated noise', () => {
  const commits = [
    commit('2026-08-13T09:00:00.000Z', 'ana@example.com', [
      'src/a.ts',
      'package-lock.json',
      'dist/bundle.js',
      'web/app.min.js',
    ]),
  ]

  expect(aggregate('30d', commits, NOW).kpis.filesTouched).toBe(1)
})

test('on all the buckets are months and there is no previous-window series', () => {
  const result = aggregate('all', [commit('2026-08-01T09:00:00.000Z', 'ana@example.com')], NOW)

  expect(result.bucket).toBe('month')
  expect(result.previousWindowBuckets).toBeNull()
  expect(result.from).toBe('2026-08-01T00:00:00.000Z')
  expect(result.to).toBe('2026-09-01T00:00:00.000Z')
})
