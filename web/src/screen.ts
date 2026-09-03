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

export type SnapshotNotice =
  | { kind: 'never-fetched' }
  | { kind: 'fresh'; fetchedAt: string }
  | { kind: 'stale'; fetchedAt: string }

export type HeaderHistory =
  | { kind: 'unknown' }
  | { kind: 'none' }
  | { kind: 'last-commit'; at: string }

export interface Dashboard {
  screen: Screen
  history: HeaderHistory
  snapshot: SnapshotNotice
}

export interface Selection {
  repos: readonly Clone[]
  repoId: string
  load: SummaryLoad
}

export class ScreenChoice {
  static of(selection: Selection): Dashboard {
    const screen = ScreenChoice.screenOf(selection)
    return {
      screen,
      history: ScreenChoice.historyOn(screen),
      snapshot: ScreenChoice.snapshotOf(selection),
    }
  }

  private static screenOf(selection: Selection): Screen {
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

  private static historyOn(screen: Screen): HeaderHistory {
    switch (screen.kind) {
      case 'no-commits':
        return { kind: 'none' }
      case 'blocks':
        return ScreenChoice.historyIn(screen.summary)
      case 'analysing':
      case 'not-a-git-repo':
      case 'failed':
        return { kind: 'unknown' }
    }
  }

  private static historyIn(summary: Summary): HeaderHistory {
    const { lastCommitAt } = summary.meta
    return lastCommitAt === null ? { kind: 'unknown' } : { kind: 'last-commit', at: lastCommitAt }
  }

  private static snapshotOf(selection: Selection): SnapshotNotice {
    const clone = ScreenChoice.selectedClone(selection)
    if (clone === undefined || clone.fetchedAt === null) {
      return { kind: 'never-fetched' }
    }
    return clone.stale
      ? { kind: 'stale', fetchedAt: clone.fetchedAt }
      : { kind: 'fresh', fetchedAt: clone.fetchedAt }
  }

  private static repoNameOf(selection: Selection): string {
    return ScreenChoice.selectedClone(selection)?.name ?? selection.repoId
  }

  private static selectedClone(selection: Selection): Clone | undefined {
    return selection.repos.find((repo) => repo.id === selection.repoId)
  }
}
