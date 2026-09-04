import { expect, test } from 'vitest'
import { ChampionRows } from './champion-rows'
import type { Clone, RepoCoverage } from './api/types'

class CoverageMother {
  static measured(id: string, percentage: number): RepoCoverage {
    return {
      id,
      state: 'measured',
      percentage,
      lines: { covered: 1, total: 1 },
      source: 'istanbul',
      measuredAt: '2026-08-19T00:00:00Z',
    }
  }

  static noArtifact(id: string): RepoCoverage {
    return { id, state: 'no-artifact', percentage: null, lines: null, source: null, measuredAt: null }
  }
}

class CloneMother {
  static of(id: string, name = id): Clone {
    return { id, name, path: `/repos/${id}`, lastCommitAt: null, fetchedAt: null, stale: false }
  }
}

const now = new Date('2026-08-19T12:00:00Z')

test('the selected clone is marked in the ranking', () => {
  const coverage = [CoverageMother.measured('a', 80), CoverageMother.measured('b', 60)]
  const repos = [CloneMother.of('a'), CloneMother.of('b')]

  const rows = ChampionRows.of(coverage, repos, 'b', now)

  expect(rows.map((row) => row.selected)).toEqual([false, true])
})

test('a clone with no percentage gets no bar', () => {
  const coverage = [CoverageMother.noArtifact('a')]
  const repos = [CloneMother.of('a')]

  const rows = ChampionRows.of(coverage, repos, 'a', now)

  expect(rows.map((row) => row.barPercent)).toEqual([0])
})

test('the order the server sent is kept untouched', () => {
  const coverage = [CoverageMother.measured('b', 60), CoverageMother.measured('a', 80)]
  const repos = [CloneMother.of('a'), CloneMother.of('b')]

  const rows = ChampionRows.of(coverage, repos, 'a', now)

  expect(rows.map((row) => row.id)).toEqual(['b', 'a'])
})

test('a ranking with no measured clone answers its own headline', () => {
  expect(ChampionRows.emptyHeadline()).toBe('Ningún clon trae datos de cobertura.')
})
