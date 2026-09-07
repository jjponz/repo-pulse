import { LineCount } from './line-count.js'
import { UnreadableArtifact } from './unreadable-artifact.js'

export class IstanbulArtifact {
  static linesFrom(text: string): LineCount {
    const parsed = IstanbulArtifact.parse(text)
    const lines = IstanbulArtifact.linesSectionOf(parsed)
    if (lines === undefined) return LineCount.of(0, 0)
    return LineCount.of(
      IstanbulArtifact.numberAt(lines, 'covered'),
      IstanbulArtifact.numberAt(lines, 'total'),
    )
  }

  private static parse(text: string): unknown {
    try {
      return JSON.parse(text)
    } catch {
      throw new UnreadableArtifact()
    }
  }

  private static linesSectionOf(parsed: unknown): Record<string, unknown> | undefined {
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const total = (parsed as Record<string, unknown>).total
    if (typeof total !== 'object' || total === null) return undefined
    const lines = (total as Record<string, unknown>).lines
    if (typeof lines !== 'object' || lines === null) return undefined
    return lines as Record<string, unknown>
  }

  private static numberAt(section: Record<string, unknown>, key: string): number {
    const value = section[key]
    if (value === undefined) return 0
    if (typeof value !== 'number') throw new UnreadableArtifact()
    return value
  }
}
