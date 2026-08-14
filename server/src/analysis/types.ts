/**
 * Contracts of the analysis module.
 *
 * No public type carries author identity: the email is used as an aggregation
 * key inside the module and dies here. Only counts, percentages and dates get
 * out.
 */

export type TimeWindow = '30d' | '90d' | '12m' | 'all'

export type BucketSize = 'day' | 'week' | 'month'

/** A non-merge commit reachable from HEAD. Internal to the module. */
export interface Commit {
  sha: string
  /** author date in epoch ms */
  date: number
  /** lowercased author email with `.mailmap` applied; does NOT leave the module */
  author: string
  /** touched paths, exactly as git reports them (noise not filtered out) */
  files: readonly string[]
}

export interface Bucket {
  /** start of the bucket in ISO 8601 UTC */
  start: string
  commits: number
  /** distinct authors with at least one commit in the bucket */
  authors: number
}

export type NotComparableReason = 'full-window' | 'no-previous-commits'

export interface Trend {
  comparable: boolean
  /** variation in % against the previous window; null when not comparable */
  percentage: number | null
  previousWindowCommits: number | null
  reason: NotComparableReason | null
}

export interface Kpis {
  commits: number
  activeAuthors: number
  /** distinct files touched in the window, generated noise excluded */
  filesTouched: number
}

export interface Concentration {
  /** minimum number of authors that add up to 80% or more of the window's commits */
  authors: number
  /** % of commits those authors accumulate, rounded */
  percentage: number
}

export interface Analysis {
  window: TimeWindow
  bucket: BucketSize
  /** start of the window in ISO 8601 UTC; null when `all` has no commits at all */
  from: string | null
  /** EXCLUSIVE end of the window in ISO 8601 UTC */
  to: string
  /** HEAD sha; null when the repo has no commits */
  headSha: string | null
  buckets: Bucket[]
  /** commits per bucket of the equally long previous window; null on `all` */
  previousWindowBuckets: number[] | null
  trend: Trend
  kpis: Kpis
  concentration: Concentration
}
