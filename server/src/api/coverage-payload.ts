import type { CoverageFormat } from '../coverage/coverage-format.js'
import type { RankedCoverage } from '../coverage/coverage-ranking.js'
import type { CoverageState } from '../coverage/coverage-reading.js'
import type { RepoCoverage } from '../coverage/repo-coverage.js'

export interface CoverageEntryPayload {
  id: string
  state: CoverageState
  percentage: number | null
  lines: { covered: number; total: number } | null
  source: CoverageFormat | null
  measuredAt: string | null
}

export class CoveragePayload {
  static of(ranked: RankedCoverage): { coverage: CoverageEntryPayload[] } {
    return { coverage: ranked.entries.map((entry) => CoveragePayload.entryOf(entry)) }
  }

  private static entryOf(entry: RepoCoverage): CoverageEntryPayload {
    const reading = entry.reading
    if (reading.state === 'measured') {
      return {
        id: entry.id,
        state: reading.state,
        percentage: reading.lines.percentage(),
        lines: { covered: reading.lines.covered, total: reading.lines.total },
        source: reading.source,
        measuredAt: reading.measuredAt.toISOString(),
      }
    }
    return {
      id: entry.id,
      state: reading.state,
      percentage: null,
      lines: null,
      source: null,
      measuredAt: null,
    }
  }
}
