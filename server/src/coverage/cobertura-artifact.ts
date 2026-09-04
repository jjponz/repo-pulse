import { LineCount } from './line-count.js'
import { UnreadableArtifact } from './unreadable-artifact.js'

export class CoberturaArtifact {
  static linesFrom(text: string): LineCount {
    const element = CoberturaArtifact.rootElementOf(text)
    return LineCount.of(
      CoberturaArtifact.attributeOf(element, 'lines-covered'),
      CoberturaArtifact.attributeOf(element, 'lines-valid'),
    )
  }

  private static rootElementOf(text: string): string {
    const match = /<coverage(\s[^>]*)?>/.exec(text)
    if (match === null) throw new UnreadableArtifact()
    return match[1] ?? ''
  }

  private static attributeOf(element: string, name: string): number {
    const match = new RegExp(`${name}="([^"]*)"`).exec(element)
    if (match === null) return 0
    const value = Number(match[1])
    if (Number.isNaN(value)) throw new UnreadableArtifact()
    return value
  }
}
