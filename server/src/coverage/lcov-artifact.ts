import { LineCount } from './line-count.js'
import { UnreadableArtifact } from './unreadable-artifact.js'

export class LcovArtifact {
  static linesFrom(text: string): LineCount {
    const lines = text.split('\n')
    if (!lines.some((line) => line.startsWith('SF:'))) throw new UnreadableArtifact()

    let covered = 0
    let total = 0
    for (const line of lines) {
      total += LcovArtifact.counterOf(line, 'LF:')
      covered += LcovArtifact.counterOf(line, 'LH:')
    }
    return LineCount.of(covered, total)
  }

  private static counterOf(line: string, prefix: string): number {
    return line.startsWith(prefix) ? Number(line.slice(prefix.length)) : 0
  }
}
