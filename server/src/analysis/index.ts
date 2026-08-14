import { aggregate } from './aggregate.js'
import { readHistory } from './git.js'
import type { Analysis, TimeWindow } from './types.js'

export interface WalkHistoryOptions {
  /** reference instant of the window; defaults to the moment of the call */
  now?: Date
}

/**
 * Walks the HEAD history of the `repo` clone and returns the analysis of the
 * requested window: commit buckets, authors per bucket, trend against the
 * previous window, KPIs and authorship concentration.
 *
 * It is the module's only entry point, and the module is the only code in the
 * repo that runs git. No author name or email gets out of here.
 */
export async function walkHistory(
  repo: string,
  window: TimeWindow,
  options: WalkHistoryOptions = {},
): Promise<Analysis> {
  const now = (options.now ?? new Date()).getTime()
  const { headSha, commits } = await readHistory(repo)
  return { ...aggregate(window, commits, now), headSha }
}

export { AnalysisError, readHeadSha } from './git.js'
// `History` is deliberately NOT exported: it carries `Commit[]`, and a `Commit`
// carries the author email. That type dies in the module, like the data.
export type { AnalysisErrorCode } from './git.js'
export { heatTree } from './heat.js'
export type { Heat, HeatEntry } from './heat.js'
export { WINDOWS, DEFAULT_WINDOW, isTimeWindow } from './windows.js'
export type {
  Analysis,
  Bucket,
  BucketSize,
  Concentration,
  Kpis,
  NotComparableReason,
  TimeWindow,
  Trend,
} from './types.js'
