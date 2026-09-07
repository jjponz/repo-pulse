import { countTouching, isWithin, normalizePath, resolveMainFolder, touchedChildren } from './heat.js'
import { bucketIndex, buildGrid } from './windows.js'
import type { Commit, TimeWindow } from './types.js'

export const MIN_CO_OCCURRENCES = 5

export interface CouplingPair {
  a: string
  aKind: 'dir' | 'file'
  b: string
  bKind: 'dir' | 'file'
  coChanges: number
  percent: number
}

export interface CouplingScope {
  repo: string
  window: TimeWindow
  mainFolder?: string
  path?: string
  now?: Date
}

export interface Coupling {
  mainFolder: string
  fallback: boolean
  path: string
  commits: number
  minCoOccurrences: number
  headSha: string | null
  pairs: readonly CouplingPair[]
}

type TouchedChild = { kind: 'dir' | 'file'; commits: Set<string> }

export class AnalyzeCoupling {
  constructor(
    private readonly readDirectories: (repo: string) => Promise<string[]>,
    private readonly readHistory: (repo: string) => Promise<{ headSha: string | null; commits: Commit[] }>,
  ) {}

  async run(scope: CouplingScope): Promise<Coupling> {
    const now = (scope.now ?? new Date()).getTime()
    const [directories, { headSha, commits }] = await Promise.all([
      this.readDirectories(scope.repo),
      this.readHistory(scope.repo),
    ])

    const mainFolder = resolveMainFolder(directories, normalizePath(scope.mainFolder))
    const path = normalizePath(scope.path) ?? mainFolder.mainFolder

    const grid = buildGrid(
      scope.window,
      now,
      commits.map((commit) => commit.date),
    )
    const inWindow = commits.filter((commit) => bucketIndex(grid, commit.date) !== null)

    const pathCommits = countTouching(inWindow, path)
    const pairs = isWithin(mainFolder.mainFolder, path) ? this.pairsOf(touchedChildren(inWindow, path)) : []

    return {
      ...mainFolder,
      path,
      commits: pathCommits,
      minCoOccurrences: MIN_CO_OCCURRENCES,
      headSha,
      pairs,
    }
  }

  private pairsOf(children: Map<string, TouchedChild>): CouplingPair[] {
    const sorted = [...children.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    const pairs: CouplingPair[] = []

    for (const [index, [a, aEntry]] of sorted.entries()) {
      for (const [b, bEntry] of sorted.slice(index + 1)) {
        const coChanges = this.intersectionSize(aEntry.commits, bEntry.commits)
        if (coChanges < MIN_CO_OCCURRENCES) continue
        const percent = Math.round((coChanges / Math.min(aEntry.commits.size, bEntry.commits.size)) * 100)
        pairs.push({ a, aKind: aEntry.kind, b, bKind: bEntry.kind, coChanges, percent })
      }
    }

    return pairs.sort(
      (x, y) => y.percent - x.percent || y.coChanges - x.coChanges || (x.a < y.a ? -1 : x.a > y.a ? 1 : 0),
    )
  }

  private intersectionSize(x: Set<string>, y: Set<string>): number {
    let count = 0
    for (const sha of x) if (y.has(sha)) count += 1
    return count
  }
}
