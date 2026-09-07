import type { RepoCoverage } from './repo-coverage.js'
import type { CoverageState } from './coverage-reading.js'

export class CoverageOrder {
  sort(entries: readonly RepoCoverage[]): RepoCoverage[] {
    return [...entries].sort((one, other) => this.compare(one, other))
  }

  private compare(one: RepoCoverage, other: RepoCoverage): number {
    const rankDiff = this.rankOf(one.reading.state) - this.rankOf(other.reading.state)
    if (rankDiff !== 0) return rankDiff
    if (one.reading.state === 'measured' && other.reading.state === 'measured') {
      const percentageDiff = other.reading.lines.percentage() - one.reading.lines.percentage()
      if (percentageDiff !== 0) return percentageDiff
    }
    return this.byId(one.id, other.id)
  }

  private rankOf(state: CoverageState): number {
    switch (state) {
      case 'measured':
        return 0
      case 'no-artifact':
        return 1
      case 'unreadable-artifact':
        return 2
    }
  }

  private byId(one: string, other: string): number {
    if (one === other) return 0
    return one < other ? -1 : 1
  }
}
