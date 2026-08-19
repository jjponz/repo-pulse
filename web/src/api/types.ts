/**
 * Payload contracts of the `server/` API, declared here instead of imported
 * from `server/`: `web/` must never import from `server/`, because a type
 * imported from there could drag author identity into the DOM. Keep this file
 * in sync with `server/src/analysis/types.ts` and `server/src/api/errors.ts`
 * by hand.
 */

export type TimeWindow = '30d' | '90d' | '12m' | 'all'

export type BucketSize = 'day' | 'week' | 'month'

export type ApiErrorCode =
  | 'unknown-repo'
  | 'not-a-git-repo'
  | 'invalid-window'
  | 'invalid-body'
  | 'not-found'
  | 'git-failed'
  | 'internal'

export type NotComparableReason = 'full-window' | 'no-previous-commits'

/** One entry of `GET /repos`. No author identity: only counts and dates. */
export interface Clone {
  id: string
  name: string
  path: string
  lastCommitAt: string | null
  fetchedAt: string | null
  stale: boolean
}

export interface Bucket {
  /** start of the bucket in ISO 8601 UTC */
  start: string
  commits: number
  /** distinct authors with at least one commit in the bucket */
  authors: number
}

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
  filesTouched: number
}

export interface Concentration {
  /** minimum number of authors that add up to 80% or more of the window's commits */
  authors: number
  /** % of commits those authors accumulate, rounded */
  percentage: number
}

export interface SummaryMeta {
  lastCommitAt: string | null
  fetchedAt: string | null
  stale: boolean
}

export interface Summary {
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
  meta: SummaryMeta
}

export const WINDOWS: readonly TimeWindow[] = ['30d', '90d', '12m', 'all']

export const DEFAULT_WINDOW: TimeWindow = '12m'
