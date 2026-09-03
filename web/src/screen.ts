import { DEFAULT_WINDOW } from './api/types'
import type { ApiErrorCode, Clone, Summary, TimeWindow } from './api/types'

export type SummaryLoad =
  | { status: 'loading' }
  | { status: 'loaded'; summary: Summary }
  | { status: 'failed'; code: ApiErrorCode }

export type EmptyWindowCta = { kind: 'switch'; window: TimeWindow } | { kind: 'already-there' }

export type Activity = { kind: 'series' } | { kind: 'empty-window'; cta: EmptyWindowCta }

export type Screen =
  | { kind: 'analysing'; repoName: string }
  | { kind: 'not-a-git-repo'; repoId: string; clones: readonly Clone[] }
  | { kind: 'no-commits'; repoName: string }
  | { kind: 'failed'; code: ApiErrorCode }
  | { kind: 'blocks'; repoName: string; summary: Summary; activity: Activity }

export interface Selection {
  repos: readonly Clone[]
  repoId: string
  load: SummaryLoad
}

export class ScreenChoice {
  static of(selection: Selection): Screen {
    const { load } = selection
    switch (load.status) {
      case 'failed':
        return ScreenChoice.afterFailure(selection, load.code)
      case 'loading':
        return { kind: 'analysing', repoName: ScreenChoice.repoNameOf(selection) }
      case 'loaded':
        return ScreenChoice.afterSummary(selection, load.summary)
    }
  }

  private static afterFailure(selection: Selection, code: ApiErrorCode): Screen {
    return code === 'not-a-git-repo'
      ? { kind: 'not-a-git-repo', repoId: selection.repoId, clones: selection.repos }
      : { kind: 'failed', code }
  }

  private static afterSummary(selection: Selection, summary: Summary): Screen {
    const repoName = ScreenChoice.repoNameOf(selection)
    if (summary.headSha === null) {
      return { kind: 'no-commits', repoName }
    }
    return { kind: 'blocks', repoName, summary, activity: ScreenChoice.activityIn(summary) }
  }

  private static activityIn(summary: Summary): Activity {
    return summary.kpis.commits === 0
      ? { kind: 'empty-window', cta: ScreenChoice.ctaFrom(summary.window) }
      : { kind: 'series' }
  }

  private static ctaFrom(window: TimeWindow): EmptyWindowCta {
    return window === DEFAULT_WINDOW
      ? { kind: 'already-there' }
      : { kind: 'switch', window: DEFAULT_WINDOW }
  }

  private static repoNameOf(selection: Selection): string {
    return selection.repos.find((repo) => repo.id === selection.repoId)?.name ?? selection.repoId
  }
}
