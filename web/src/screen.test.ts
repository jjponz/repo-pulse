import { expect, test } from 'vitest'
import { ScreenChoice } from './screen'
import type { EmptyWindowCta, Screen, Selection, SummaryLoad } from './screen'
import { DEFAULT_WINDOW } from './api/types'
import type { ApiErrorCode, Clone, Summary, TimeWindow } from './api/types'

class ScreenProbe {
  static emptyWindowCta(screen: Screen): EmptyWindowCta {
    if (screen.kind !== 'blocks' || screen.activity.kind !== 'empty-window') {
      throw new Error(`not an empty window: ${screen.kind}`)
    }
    return screen.activity.cta
  }
}

class CloneMother {
  static readonly THE_DAY_BEFORE_YESTERDAY = '2026-09-01T09:00:00Z'
  static readonly A_YEAR_AGO = '2025-09-02T09:00:00Z'

  static freshlyFetched(id: string, name: string): Clone {
    return { ...CloneMother.listedAs(id, name), fetchedAt: '2026-08-19T11:00:00Z', stale: false }
  }

  static neverFetched(id: string, name: string): Clone {
    return CloneMother.listedAs(id, name)
  }

  static declaredStaleFetchedTheDayBeforeYesterday(id: string, name: string): Clone {
    return {
      ...CloneMother.listedAs(id, name),
      fetchedAt: CloneMother.THE_DAY_BEFORE_YESTERDAY,
      stale: true,
    }
  }

  static declaredFreshFetchedAYearAgo(id: string, name: string): Clone {
    return { ...CloneMother.listedAs(id, name), fetchedAt: CloneMother.A_YEAR_AGO, stale: false }
  }

  private static listedAs(id: string, name: string): Clone {
    return {
      id,
      name,
      path: `/git/${name}`,
      lastCommitAt: '2026-08-19T10:00:00Z',
      fetchedAt: null,
      stale: false,
    }
  }
}

class SummaryMother {
  static readonly LAST_COMMIT_AT = '2026-08-28T18:30:00Z'

  static withNoHistory(): Summary {
    return { ...SummaryMother.base('12m'), headSha: null, from: null }
  }

  static withNoCommitsIn(window: TimeWindow): Summary {
    return SummaryMother.base(window)
  }

  static withCommitsIn(window: TimeWindow): Summary {
    const summary = SummaryMother.base(window)
    return {
      ...summary,
      buckets: [{ start: '2026-08-01T00:00:00Z', commits: 4, authors: 2 }],
      kpis: { commits: 4, activeAuthors: 2, filesTouched: 9 },
      concentration: { authors: 1, percentage: 80 },
      meta: { ...summary.meta, lastCommitAt: SummaryMother.LAST_COMMIT_AT },
    }
  }

  private static base(window: TimeWindow): Summary {
    return {
      window,
      bucket: 'month',
      from: '2025-09-01T00:00:00Z',
      to: '2026-09-01T00:00:00Z',
      headSha: '0f1e2d3c4b5a69788796a5b4c3d2e1f001234567',
      buckets: [],
      previousWindowBuckets: null,
      trend: { comparable: false, percentage: null, previousWindowCommits: null, reason: 'full-window' },
      kpis: { commits: 0, activeAuthors: 0, filesTouched: 0 },
      concentration: { authors: 0, percentage: 0 },
      meta: { lastCommitAt: null, fetchedAt: null, stale: false },
    }
  }
}

class SelectionMother {
  static readonly REPO_ID = 'clone-1'
  static readonly REPOS: readonly Clone[] = [
    CloneMother.freshlyFetched('clone-1', 'repo-pulse'),
    CloneMother.freshlyFetched('clone-2', 'mo.heatmap.web'),
  ]

  static stillLoading(): Selection {
    return SelectionMother.selecting({ status: 'loading' })
  }

  static loadingWith(repos: readonly Clone[]): Selection {
    return { repos, repoId: SelectionMother.REPO_ID, load: { status: 'loading' } }
  }

  static loadingAnUnlistedRepo(): Selection {
    return SelectionMother.loadingWith([])
  }

  static failedWith(code: ApiErrorCode): Selection {
    return SelectionMother.selecting({ status: 'failed', code })
  }

  static loaded(summary: Summary): Selection {
    return SelectionMother.selecting({ status: 'loaded', summary })
  }

  private static selecting(load: SummaryLoad): Selection {
    return { repos: SelectionMother.REPOS, repoId: SelectionMother.REPO_ID, load }
  }
}

test('a summary still loading is the analysing screen', () => {
  const screen = ScreenChoice.of(SelectionMother.stillLoading()).screen

  expect(screen).toEqual({ kind: 'analysing', repoName: 'repo-pulse' })
  expect(ScreenChoice.of(SelectionMother.loadingAnUnlistedRepo()).screen).toEqual({
    kind: 'analysing',
    repoName: SelectionMother.REPO_ID,
  })
})

test('a not-a-git-repo failure is its own screen, with the detected clones', () => {
  const screen = ScreenChoice.of(SelectionMother.failedWith('not-a-git-repo')).screen

  expect(screen).toEqual({
    kind: 'not-a-git-repo',
    repoId: SelectionMother.REPO_ID,
    clones: SelectionMother.REPOS,
  })
})

test('any other failure is the failed screen, carrying the code', () => {
  expect(ScreenChoice.of(SelectionMother.failedWith('git-failed')).screen).toEqual({
    kind: 'failed',
    code: 'git-failed',
  })
  expect(ScreenChoice.of(SelectionMother.failedWith('unknown-repo')).screen).toEqual({
    kind: 'failed',
    code: 'unknown-repo',
  })
})

test('a repo with no head sha is the no-commits screen, not an empty window', () => {
  const screen = ScreenChoice.of(SelectionMother.loaded(SummaryMother.withNoHistory())).screen

  expect(screen).toEqual({ kind: 'no-commits', repoName: 'repo-pulse' })
})

test('a window with no commits is the blocks screen with an empty-window activity', () => {
  const summary = SummaryMother.withNoCommitsIn('30d')

  const screen = ScreenChoice.of(SelectionMother.loaded(summary)).screen

  expect(screen).toEqual({
    kind: 'blocks',
    repoName: 'repo-pulse',
    summary,
    activity: { kind: 'empty-window', cta: { kind: 'switch', window: DEFAULT_WINDOW } },
  })
})

test('the empty-window cta switches to the default window and is already-there on it', () => {
  const elsewhere = ScreenChoice.of(
    SelectionMother.loaded(SummaryMother.withNoCommitsIn('90d')),
  ).screen
  const onTheDefault = ScreenChoice.of(
    SelectionMother.loaded(SummaryMother.withNoCommitsIn(DEFAULT_WINDOW)),
  ).screen

  expect(ScreenProbe.emptyWindowCta(elsewhere)).toEqual({ kind: 'switch', window: '12m' })
  expect(ScreenProbe.emptyWindowCta(onTheDefault)).toEqual({ kind: 'already-there' })
})

test('a window with commits is the blocks screen with a series activity', () => {
  const summary = SummaryMother.withCommitsIn('30d')

  const screen = ScreenChoice.of(SelectionMother.loaded(summary)).screen

  expect(screen).toEqual({
    kind: 'blocks',
    repoName: 'repo-pulse',
    summary,
    activity: { kind: 'series' },
  })
})

test('a clone that never fetched has a never-fetched snapshot notice', () => {
  const neverFetched = ScreenChoice.of(
    SelectionMother.loadingWith([CloneMother.neverFetched(SelectionMother.REPO_ID, 'repo-pulse')]),
  )

  expect(neverFetched.snapshot).toEqual({ kind: 'never-fetched' })
  expect(ScreenChoice.of(SelectionMother.loadingAnUnlistedRepo()).snapshot).toEqual({
    kind: 'never-fetched',
  })
})

test('the snapshot notice repeats the staleness the payload declares, it does not recompute it', () => {
  const recentlyFetchedButDeclaredStale = ScreenChoice.of(
    SelectionMother.loadingWith([
      CloneMother.declaredStaleFetchedTheDayBeforeYesterday(SelectionMother.REPO_ID, 'repo-pulse'),
    ]),
  )
  const fetchedLongAgoButDeclaredFresh = ScreenChoice.of(
    SelectionMother.loadingWith([
      CloneMother.declaredFreshFetchedAYearAgo(SelectionMother.REPO_ID, 'repo-pulse'),
    ]),
  )

  expect(recentlyFetchedButDeclaredStale.snapshot).toEqual({
    kind: 'stale',
    fetchedAt: CloneMother.THE_DAY_BEFORE_YESTERDAY,
  })
  expect(fetchedLongAgoButDeclaredFresh.snapshot).toEqual({
    kind: 'fresh',
    fetchedAt: CloneMother.A_YEAR_AGO,
  })
})

test('the header history is none on the no-commits screen and unknown while loading', () => {
  const withoutAnyCommit = ScreenChoice.of(SelectionMother.loaded(SummaryMother.withNoHistory()))

  expect(withoutAnyCommit.history).toEqual({ kind: 'none' })
  expect(ScreenChoice.of(SelectionMother.stillLoading()).history).toEqual({ kind: 'unknown' })
})

test('the header history carries the last commit date of a loaded window', () => {
  const loaded = ScreenChoice.of(SelectionMother.loaded(SummaryMother.withCommitsIn('30d')))

  expect(loaded.history).toEqual({ kind: 'last-commit', at: SummaryMother.LAST_COMMIT_AT })
})
