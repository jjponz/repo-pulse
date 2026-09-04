import { CoverageReadings } from './coverage-reading.js'
import { UnreadableArtifact } from './unreadable-artifact.js'
import type { CoverageArtifacts } from './coverage-artifacts.js'
import type { CoverageOrder } from './coverage-order.js'
import type { RepoCoverage } from './repo-coverage.js'
import type { Catalog, Clone } from '../repos.js'

export interface RankedCoverage {
  entries: readonly RepoCoverage[]
}

export class CoverageRanking {
  constructor(
    private readonly deps: { catalog: Catalog; artifacts: CoverageArtifacts; order: CoverageOrder },
  ) {}

  async run(): Promise<RankedCoverage> {
    const clones = await this.deps.catalog.list()
    const entries = await Promise.all(clones.map((clone) => this.readingOf(clone)))
    return { entries: this.deps.order.sort(entries) }
  }

  private async readingOf(clone: Clone): Promise<RepoCoverage> {
    try {
      const reading = await this.deps.artifacts.readingOf(clone.path)
      return { id: clone.id, reading }
    } catch (error) {
      if (error instanceof UnreadableArtifact) {
        return { id: clone.id, reading: CoverageReadings.unreadableArtifact() }
      }
      throw error
    }
  }
}
