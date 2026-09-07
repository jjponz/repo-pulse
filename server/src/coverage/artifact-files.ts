import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { CoberturaArtifact } from './cobertura-artifact.js'
import { CoverageReadings } from './coverage-reading.js'
import { IstanbulArtifact } from './istanbul-artifact.js'
import { LcovArtifact } from './lcov-artifact.js'
import type { Stats } from 'node:fs'
import type { Cache } from '../api/routes.js'
import type { CoverageArtifacts } from './coverage-artifacts.js'
import type { CoverageFormat } from './coverage-format.js'
import type { CoverageReading } from './coverage-reading.js'
import type { LineCount } from './line-count.js'

export const COVERAGE_CANDIDATES: readonly { path: string; source: CoverageFormat }[] = [
  { path: 'coverage/coverage-summary.json', source: 'istanbul' },
  { path: 'coverage/lcov.info', source: 'lcov' },
  { path: 'lcov.info', source: 'lcov' },
  { path: 'coverage/coverage.xml', source: 'cobertura' },
  { path: 'coverage.xml', source: 'cobertura' },
]

interface ArtifactReader {
  linesFrom(text: string): LineCount
}

const READERS: Record<CoverageFormat, ArtifactReader> = {
  istanbul: IstanbulArtifact,
  lcov: LcovArtifact,
  cobertura: CoberturaArtifact,
}

export class ArtifactFiles implements CoverageArtifacts {
  constructor(private readonly cache: Cache<CoverageReading>) {}

  async readingOf(repoPath: string): Promise<CoverageReading> {
    for (const candidate of COVERAGE_CANDIDATES) {
      const reading = await this.readingOfCandidate(repoPath, candidate)
      if (reading.state === 'measured') return reading
    }
    return CoverageReadings.noArtifact()
  }

  private async readingOfCandidate(
    repoPath: string,
    candidate: { path: string; source: CoverageFormat },
  ): Promise<CoverageReading> {
    const absolutePath = join(repoPath, candidate.path)
    const stats = await ArtifactFiles.statOrNull(absolutePath)
    if (stats === null) return CoverageReadings.noArtifact()
    const key = [repoPath, candidate.path, String(stats.mtimeMs)].join('\u0000')
    return this.cache.remember(key, () => ArtifactFiles.parse(absolutePath, candidate.source, stats.mtime))
  }

  private static async parse(
    absolutePath: string,
    source: CoverageFormat,
    measuredAt: Date,
  ): Promise<CoverageReading> {
    const text = await readFile(absolutePath, 'utf8')
    const lines = READERS[source].linesFrom(text)
    return CoverageReadings.of(lines, source, measuredAt)
  }

  private static async statOrNull(path: string): Promise<Stats | null> {
    try {
      return await stat(path)
    } catch {
      return null
    }
  }
}
