import { afterAll, beforeAll, expect, test } from 'vitest'
import { WINDOWS, walkHistory } from './index.js'
import { createRepoFixture, nonMergeCommits } from '../testing/repo-fixture.js'
import type { CommitFixture, RepoFixture } from '../testing/repo-fixture.js'

/** Fixed reference instant: the fixture dates are known and do not expire. */
const NOW = new Date('2026-08-13T12:00:00.000Z')

/**
 * 9 commits on main + 1 on the branch that gets merged = 10 non-merge commits,
 * all within the last 30 days of NOW. Split by author: ana 5 (two of them with
 * the email in uppercase), bea 3, cris 1, dani 1.
 */
const COMMITS: readonly CommitFixture[] = [
  { date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts'] },
  { date: '2026-07-21T09:00:00+00:00', email: 'Ana@Example.com', files: ['src/b.ts'] },
  { date: '2026-07-22T09:00:00+00:00', email: 'bea@example.com', files: ['src/f.ts'] },
  {
    date: '2026-07-28T09:00:00+00:00',
    email: 'ana@example.com',
    files: ['src/c.ts', 'package-lock.json'],
  },
  {
    date: '2026-08-03T09:00:00+00:00',
    email: 'Ana@Example.com',
    files: ['src/d.ts', 'dist/bundle.js'],
  },
  { date: '2026-08-04T09:00:00+00:00', email: 'bea@example.com', files: ['src/g.ts'] },
  { date: '2026-08-10T09:00:00+00:00', email: 'ana@example.com', files: ['src/e.ts'] },
  {
    date: '2026-08-11T09:00:00+00:00',
    email: 'bea@example.com',
    files: ['src/h.ts', 'web/app.min.js'],
  },
  { date: '2026-08-12T09:00:00+00:00', email: 'cris@example.com', files: ['src/i.ts'] },
]

const MERGE: CommitFixture = {
  date: '2026-08-12T10:00:00+00:00',
  email: 'dani@example.com',
  files: ['src/j.ts'],
}

let fixture: RepoFixture

beforeAll(() => {
  fixture = createRepoFixture({ commits: COMMITS, merge: MERGE })
})

afterAll(() => {
  fixture.cleanup()
})

test('with a fixture of known dates the buckets add up to the total of non-merge commits', async () => {
  const total = nonMergeCommits(fixture.path)
  expect(total).toBe(10)

  const sums: Record<string, number> = {}
  for (const window of WINDOWS) {
    const analysis = await walkHistory(fixture.path, window, { now: NOW })
    sums[window] = analysis.buckets.reduce((accumulated, bucket) => accumulated + bucket.commits, 0)
    expect(analysis.kpis.commits).toBe(total)
  }

  expect(sums).toEqual({ '30d': total, '90d': total, '12m': total, all: total })
})

test('two emails of the same author differing in case count as one author', async () => {
  const analysis = await walkHistory(fixture.path, '30d', { now: NOW })

  // ana@example.com signs 3 commits and Ana@Example.com another 2: it is a
  // single author, so active authors are 4 (ana, bea, cris, dani) and not 5.
  expect(analysis.kpis.activeAuthors).toBe(4)
  expect(analysis.concentration.authors).toBe(2)
})

test('on the `all` window the trend is null and declared not comparable', async () => {
  const analysis = await walkHistory(fixture.path, 'all', { now: NOW })

  expect(analysis.trend).toEqual({
    comparable: false,
    percentage: null,
    previousWindowCommits: null,
    reason: 'full-window',
  })
  expect(analysis.previousWindowBuckets).toBeNull()
})

test('concentration is the minimum number of authors adding up to 80% or more', async () => {
  const analysis = await walkHistory(fixture.path, '12m', { now: NOW })

  // 5 + 3 out of 10 commits = exactly 80%: two authors, and one is not enough.
  expect(analysis.concentration).toEqual({ authors: 2, percentage: 80 })
})

test('the analysis exposes no author email', async () => {
  const analysis = await walkHistory(fixture.path, '12m', { now: NOW })

  expect(JSON.stringify(analysis)).not.toContain('@')
})

test('the trend is counted against the equally long previous window', async () => {
  const withPrevious = createRepoFixture({
    commits: [
      { date: '2026-07-01T09:00:00+00:00', email: 'ana@example.com', files: ['old-1.txt'] },
      { date: '2026-07-02T09:00:00+00:00', email: 'ana@example.com', files: ['old-2.txt'] },
      { date: '2026-08-01T09:00:00+00:00', email: 'ana@example.com', files: ['new-1.txt'] },
      { date: '2026-08-02T09:00:00+00:00', email: 'bea@example.com', files: ['new-2.txt'] },
      { date: '2026-08-03T09:00:00+00:00', email: 'bea@example.com', files: ['new-3.txt'] },
    ],
  })

  try {
    const analysis = await walkHistory(withPrevious.path, '30d', { now: NOW })

    expect(analysis.trend).toEqual({
      comparable: true,
      percentage: 50,
      previousWindowCommits: 2,
      reason: null,
    })
  } finally {
    withPrevious.cleanup()
  }
})

test('a repo without commits returns the window at zero and without HEAD', async () => {
  const empty = createRepoFixture()

  try {
    const analysis = await walkHistory(empty.path, '30d', { now: NOW })

    expect(analysis.headSha).toBeNull()
    expect(analysis.buckets).toHaveLength(30)
    expect(analysis.kpis).toEqual({ commits: 0, activeAuthors: 0, filesTouched: 0 })
    expect(analysis.concentration).toEqual({ authors: 0, percentage: 0 })
  } finally {
    empty.cleanup()
  }
})

test('the touched-files KPI ignores lockfiles, bundles and generated paths', async () => {
  const analysis = await walkHistory(fixture.path, '12m', { now: NOW })

  // 10 files under src/ touched; package-lock.json, dist/bundle.js and
  // web/app.min.js do not count.
  expect(analysis.kpis.filesTouched).toBe(10)
})
