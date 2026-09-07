import type { Clone, RepoCoverage } from './api/types'
import { coverageAge, coverageHeadline } from './format'

export interface ChampionRow {
  id: string
  name: string
  headline: string
  age: string
  source: string
  barPercent: number | null
  selected: boolean
}

export class ChampionRows {
  static of(
    coverage: readonly RepoCoverage[],
    repos: readonly Clone[],
    repoId: string,
    now: Date,
  ): ChampionRow[] {
    return coverage.map((entry) => ChampionRows.toRow(entry, repos, repoId, now))
  }

  static emptyHeadline(): string {
    return 'Ningún clon trae datos de cobertura.'
  }

  private static toRow(
    entry: RepoCoverage,
    repos: readonly Clone[],
    repoId: string,
    now: Date,
  ): ChampionRow {
    const repo = repos.find((candidate) => candidate.id === entry.id)
    return {
      id: entry.id,
      name: repo === undefined ? entry.id : repo.name,
      headline: coverageHeadline(entry.state, entry.percentage),
      age: coverageAge(entry.measuredAt, now),
      source: entry.source === null ? '' : entry.source,
      barPercent: entry.percentage,
      selected: entry.id === repoId,
    }
  }
}
