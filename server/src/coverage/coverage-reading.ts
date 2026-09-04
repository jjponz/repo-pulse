import type { LineCount } from './line-count.js'
import type { CoverageFormat } from './coverage-format.js'

export type CoverageState = 'measured' | 'no-artifact' | 'unreadable-artifact'

export type CoverageReading =
  | { state: 'measured'; lines: LineCount; source: CoverageFormat; measuredAt: Date }
  | { state: 'no-artifact' }
  | { state: 'unreadable-artifact' }

export class CoverageReadings {
  static of(lines: LineCount, source: CoverageFormat, measuredAt: Date): CoverageReading {
    if (lines.total === 0) return CoverageReadings.noArtifact()
    return { state: 'measured', lines, source, measuredAt }
  }

  static noArtifact(): CoverageReading {
    return { state: 'no-artifact' }
  }

  static unreadableArtifact(): CoverageReading {
    return { state: 'unreadable-artifact' }
  }
}
