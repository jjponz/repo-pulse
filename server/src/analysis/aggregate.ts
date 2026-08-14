import { isNoise } from './noise.js'
import { bucketIndex, buildGrid } from './windows.js'
import type { Grid } from './windows.js'
import type { Analysis, Bucket, Commit, Concentration, TimeWindow, Trend } from './types.js'

/** % of commits that defines concentration: the minimum number of authors adding up to it. */
const CONCENTRATION_THRESHOLD = 80

/** Everything that can be computed without asking git again. */
export type Aggregate = Omit<Analysis, 'headSha'>

export function aggregate(
  window: TimeWindow,
  commits: readonly Commit[],
  now: number,
): Aggregate {
  const grid = buildGrid(
    window,
    now,
    commits.map((commit) => commit.date),
  )
  const byBucket = splitIntoBuckets(grid, commits)
  const buckets: Bucket[] = grid.starts.map((start, i) => {
    const inBucket = byBucket[i] ?? []
    return {
      start: new Date(start).toISOString(),
      commits: inBucket.length,
      authors: new Set(inBucket.map((commit) => commit.author)).size,
    }
  })

  const inWindow = byBucket.flat()
  const commitsByAuthor = new Map<string, number>()
  const files = new Set<string>()
  for (const commit of inWindow) {
    commitsByAuthor.set(commit.author, (commitsByAuthor.get(commit.author) ?? 0) + 1)
    for (const file of commit.files) {
      if (!isNoise(file)) files.add(file)
    }
  }

  const previousWindowBuckets = grid.previous
    ? splitIntoBuckets(grid.previous, commits).map((inBucket) => inBucket.length)
    : null
  const previousWindowCommits = previousWindowBuckets
    ? previousWindowBuckets.reduce((sum, commits) => sum + commits, 0)
    : null
  const firstStart = grid.starts[0]

  return {
    window,
    bucket: grid.bucket,
    from: firstStart === undefined ? null : new Date(firstStart).toISOString(),
    to: new Date(grid.end).toISOString(),
    buckets,
    previousWindowBuckets,
    trend: trend(inWindow.length, previousWindowCommits),
    kpis: {
      commits: inWindow.length,
      activeAuthors: commitsByAuthor.size,
      filesTouched: files.size,
    },
    concentration: concentration([...commitsByAuthor.values()]),
  }
}

export function trend(commits: number, previousWindowCommits: number | null): Trend {
  if (previousWindowCommits === null) {
    return {
      comparable: false,
      percentage: null,
      previousWindowCommits: null,
      reason: 'full-window',
    }
  }
  if (previousWindowCommits === 0) {
    return {
      comparable: false,
      percentage: null,
      previousWindowCommits: 0,
      reason: 'no-previous-commits',
    }
  }
  return {
    comparable: true,
    percentage: Math.round((commits / previousWindowCommits - 1) * 100),
    previousWindowCommits,
    reason: null,
  }
}

/**
 * Minimum number of authors adding up to 80% or more of the commits. The
 * comparison is integer (`accumulated * 100 >= 80 * total`) so that the exactly
 * 80% case does not hinge on a float.
 */
export function concentration(commitsByAuthor: readonly number[]): Concentration {
  const total = commitsByAuthor.reduce((sum, commits) => sum + commits, 0)
  if (total === 0) return { authors: 0, percentage: 0 }
  const descending = [...commitsByAuthor].sort((a, b) => b - a)
  let accumulated = 0
  let authors = 0
  for (const commits of descending) {
    accumulated += commits
    authors += 1
    if (accumulated * 100 >= CONCENTRATION_THRESHOLD * total) break
  }
  return { authors, percentage: Math.round((accumulated / total) * 100) }
}

function splitIntoBuckets(grid: Grid, commits: readonly Commit[]): Commit[][] {
  const byBucket: Commit[][] = grid.starts.map(() => [])
  for (const commit of commits) {
    const index = bucketIndex(grid, commit.date)
    if (index === null) continue
    byBucket[index]?.push(commit)
  }
  return byBucket
}
