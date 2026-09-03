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
  static freshlyFetched(id: string, name: string): Clone {
    return {
      id,
      name,
      path: `/git/${name}`,
      lastCommitAt: '2026-08-19T10:00:00Z',
      fetchedAt: '2026-08-19T11:00:00Z',
      stale: false,
    }
  }
}

class SummaryMother {
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

  static loadingAnUnlistedRepo(): Selection {
    return { repos: [], repoId: SelectionMother.REPO_ID, load: { status: 'loading' } }
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
  const screen = ScreenChoice.of(SelectionMother.stillLoading())

  expect(screen).toEqual({ kind: 'analysing', repoName: 'repo-pulse' })
  expect(ScreenChoice.of(SelectionMother.loadingAnUnlistedRepo())).toEqual({
    kind: 'analysing',
    repoName: SelectionMother.REPO_ID,
  })
})

test('a not-a-git-repo failure is its own screen, with the detected clones', () => {
  const screen = ScreenChoice.of(SelectionMother.failedWith('not-a-git-repo'))

  expect(screen).toEqual({
    kind: 'not-a-git-repo',
    repoId: SelectionMother.REPO_ID,
    clones: SelectionMother.REPOS,
  })
})

test('any other failure is the failed screen, carrying the code', () => {
  expect(ScreenChoice.of(SelectionMother.failedWith('git-failed'))).toEqual({
    kind: 'failed',
    code: 'git-failed',
  })
  expect(ScreenChoice.of(SelectionMother.failedWith('unknown-repo'))).toEqual({
    kind: 'failed',
    code: 'unknown-repo',
  })
})

test('a repo with no head sha is the no-commits screen, not an empty window', () => {
  const screen = ScreenChoice.of(SelectionMother.loaded(SummaryMother.withNoHistory()))

  expect(screen).toEqual({ kind: 'no-commits', repoName: 'repo-pulse' })
})

test('a window with no commits is the blocks screen with an empty-window activity', () => {
  const summary = SummaryMother.withNoCommitsIn('30d')

  const screen = ScreenChoice.of(SelectionMother.loaded(summary))

  expect(screen).toEqual({
    kind: 'blocks',
    repoName: 'repo-pulse',
    summary,
    activity: { kind: 'empty-window', cta: { kind: 'switch', window: DEFAULT_WINDOW } },
  })
})

test('the empty-window cta switches to the default window and is already-there on it', () => {
  const elsewhere = ScreenChoice.of(SelectionMother.loaded(SummaryMother.withNoCommitsIn('90d')))
  const onTheDefault = ScreenChoice.of(
    SelectionMother.loaded(SummaryMother.withNoCommitsIn(DEFAULT_WINDOW)),
  )

  expect(ScreenProbe.emptyWindowCta(elsewhere)).toEqual({ kind: 'switch', window: '12m' })
  expect(ScreenProbe.emptyWindowCta(onTheDefault)).toEqual({ kind: 'already-there' })
})

test('a window with commits is the blocks screen with a series activity', () => {
  const summary = SummaryMother.withCommitsIn('30d')

  const screen = ScreenChoice.of(SelectionMother.loaded(summary))

  expect(screen).toEqual({
    kind: 'blocks',
    repoName: 'repo-pulse',
    summary,
    activity: { kind: 'series' },
  })
})
