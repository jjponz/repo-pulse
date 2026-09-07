import { expect, test } from 'vitest'
import { CoverageOrder } from './coverage-order.js'
import { CoverageRanking } from './coverage-ranking.js'
import { CoverageReadings } from './coverage-reading.js'
import { LineCount } from './line-count.js'
import { UnreadableArtifact } from './unreadable-artifact.js'
import type { CoverageArtifacts } from './coverage-artifacts.js'
import type { CoverageReading } from './coverage-reading.js'
import type { Catalog, Clone } from '../repos.js'

class CloneMother {
  static at(id: string): Clone {
    return { id, name: id, path: `/clones/${id}`, lastCommitAt: null, fetchedAt: null, stale: false }
  }
}

class CatalogDouble implements Catalog {
  constructor(private readonly clones: readonly Clone[]) {}

  async list(): Promise<Clone[]> {
    return [...this.clones]
  }

  async resolve(): Promise<string | null> {
    throw new Error('not needed by this test')
  }
}

class CoverageArtifactsDouble implements CoverageArtifacts {
  private readonly answers = new Map<string, () => Promise<CoverageReading>>()

  measured(clone: Clone, covered: number, total: number): this {
    this.answers.set(clone.path, async () =>
      CoverageReadings.of(LineCount.of(covered, total), 'istanbul', new Date()),
    )
    return this
  }

  noArtifact(clone: Clone): this {
    this.answers.set(clone.path, async () => CoverageReadings.noArtifact())
    return this
  }

  unreadable(clone: Clone): this {
    this.answers.set(clone.path, async () => {
      throw new UnreadableArtifact()
    })
    return this
  }

  broken(clone: Clone, message: string): this {
    this.answers.set(clone.path, async () => {
      throw new Error(message)
    })
    return this
  }

  async readingOf(repoPath: string): Promise<CoverageReading> {
    const answer = this.answers.get(repoPath)
    if (!answer) throw new Error(`no answer configured for ${repoPath}`)
    return answer()
  }

  rankingFor(catalog: Catalog): CoverageRanking {
    return new CoverageRanking({ catalog, artifacts: this, order: new CoverageOrder() })
  }
}

test('the ranking puts the higher percentage first', async () => {
  const zeta = CloneMother.at('zeta')
  const alpha = CloneMother.at('alpha')
  const higherCoveredLines = 501
  const lowerCoveredLines = 500
  const totalLines = 1000
  const artifacts = new CoverageArtifactsDouble()
    .measured(zeta, higherCoveredLines, totalLines)
    .measured(alpha, lowerCoveredLines, totalLines)

  const { entries } = await artifacts.rankingFor(new CatalogDouble([alpha, zeta])).run()

  expect(entries.map((entry) => entry.id)).toEqual(['zeta', 'alpha'])
})

test('two clones with the same percentage are ordered by name', async () => {
  const beta = CloneMother.at('beta')
  const alpha = CloneMother.at('alpha')
  const artifacts = new CoverageArtifactsDouble()
    .measured(beta, 500, 1000)
    .measured(alpha, 500, 1000)

  const { entries } = await artifacts.rankingFor(new CatalogDouble([beta, alpha])).run()

  expect(entries.map((entry) => entry.id)).toEqual(['alpha', 'beta'])
})

test('a clone with no artifact ranks after every measured clone', async () => {
  const alpha = CloneMother.at('alpha')
  const zeta = CloneMother.at('zeta')
  const artifacts = new CoverageArtifactsDouble().noArtifact(alpha).measured(zeta, 500, 1000)

  const { entries } = await artifacts.rankingFor(new CatalogDouble([alpha, zeta])).run()

  expect(entries.map((entry) => entry.id)).toEqual(['zeta', 'alpha'])
})

test('an unreadable artifact ranks with the clones that have no data', async () => {
  const zeta = CloneMother.at('zeta')
  const alpha = CloneMother.at('alpha')
  const beta = CloneMother.at('beta')
  const artifacts = new CoverageArtifactsDouble()
    .measured(zeta, 500, 1000)
    .noArtifact(alpha)
    .unreadable(beta)

  const { entries } = await artifacts.rankingFor(new CatalogDouble([beta, alpha, zeta])).run()

  expect(entries.map((entry) => entry.id)).toEqual(['zeta', 'alpha', 'beta'])
})

test('a clone whose artifact cannot be read is reported as unreadable instead of sinking the ranking', async () => {
  const gamma = CloneMother.at('gamma')
  const artifacts = new CoverageArtifactsDouble().unreadable(gamma)

  const { entries } = await artifacts.rankingFor(new CatalogDouble([gamma])).run()

  expect(entries).toHaveLength(1)
  expect(entries[0]?.reading.state).toBe('unreadable-artifact')
})

test('a clone whose read fails for an unforeseen reason does not sink the reading of the others', async () => {
  const gamma = CloneMother.at('gamma')
  const zeta = CloneMother.at('zeta')
  const artifacts = new CoverageArtifactsDouble()
    .broken(gamma, 'EACCES: permission denied')
    .measured(zeta, 500, 1000)

  const { entries } = await artifacts.rankingFor(new CatalogDouble([gamma, zeta])).run()

  expect(entries.map((entry) => entry.id)).toEqual(['zeta', 'gamma'])
  expect(entries.map((entry) => entry.reading.state)).toEqual(['measured', 'unreadable-artifact'])
})
