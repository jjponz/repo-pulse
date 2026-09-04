import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import Champions from './Champions'
import { ChampionRows } from './champion-rows'
import type { Clone, RepoCoverage } from './api/types'

class CoverageMother {
  static measured(id: string, percentage: number): RepoCoverage {
    return {
      id,
      state: 'measured',
      percentage,
      lines: { covered: percentage, total: 100 },
      source: 'istanbul',
      measuredAt: '2026-08-18T00:00:00.000Z',
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

const NOW = new Date('2026-08-19T00:00:00.000Z')

function stubCoverage(coverage: readonly RepoCoverage[]): void {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ coverage }) } as unknown as Response),
  )
}

function stubCoverageFailure(): void {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({
      ok: false,
      status: 500,
      json: () =>
        Promise.resolve({ error: { code: 'internal', message: 'boom' } }),
    } as unknown as Response),
  )
}

test('the champions block lists every clone with its percentage', async () => {
  stubCoverage([CoverageMother.measured('a', 80), CoverageMother.measured('b', 60)])
  const repos = [CloneMother.of('a'), CloneMother.of('b')]

  render(<Champions repos={repos} repoId="a" now={NOW} />)

  expect(await screen.findByText('80,0 %')).toBeTruthy()
  expect(screen.getByText('60,0 %')).toBeTruthy()
})

test('only the selected clone is highlighted in the ranking', async () => {
  stubCoverage([CoverageMother.measured('a', 80), CoverageMother.measured('b', 60)])
  const repos = [CloneMother.of('a'), CloneMother.of('b')]

  render(<Champions repos={repos} repoId="b" now={NOW} />)
  await screen.findByText('80,0 %')

  const selectedRow = screen.getByText('60,0 %').closest('[data-testid="champion-row"]')
  const otherRow = screen.getByText('80,0 %').closest('[data-testid="champion-row"]')
  expect(selectedRow?.getAttribute('aria-current')).toBe('true')
  expect(otherRow?.getAttribute('aria-current')).toBeNull()
})

test('a clone with no artifact says sin datos de cobertura', async () => {
  stubCoverage([CoverageMother.measured('a', 80), CoverageMother.noArtifact('b')])
  const repos = [CloneMother.of('a'), CloneMother.of('b')]

  render(<Champions repos={repos} repoId="a" now={NOW} />)

  expect(await screen.findByText('Sin datos de cobertura')).toBeTruthy()
})

test('a ranking with no measured clone says so instead of drawing an empty block', async () => {
  stubCoverage([CoverageMother.noArtifact('a'), CoverageMother.noArtifact('b')])
  const repos = [CloneMother.of('a'), CloneMother.of('b')]

  render(<Champions repos={repos} repoId="a" now={NOW} />)

  expect(await screen.findByText(ChampionRows.emptyHeadline())).toBeTruthy()
  expect(screen.queryAllByTestId('champion-row')).toHaveLength(0)
})

test('a failed coverage load shows an alert', async () => {
  stubCoverageFailure()
  const repos = [CloneMother.of('a')]

  render(<Champions repos={repos} repoId="a" now={NOW} />)

  expect(await screen.findByRole('alert')).toBeTruthy()
})
