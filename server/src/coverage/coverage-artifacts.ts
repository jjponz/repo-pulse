import type { CoverageReading } from './coverage-reading.js'

export interface CoverageArtifacts {
  readingOf(repoPath: string): Promise<CoverageReading>
}
