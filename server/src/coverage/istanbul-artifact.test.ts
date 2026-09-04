import { expect, test } from 'vitest'
import { IstanbulArtifact } from './istanbul-artifact.js'
import { UnreadableArtifact } from './unreadable-artifact.js'

test('a coverage summary reads the covered and total lines of its total section', () => {
  const text = JSON.stringify({ total: { lines: { covered: 8, total: 10 } } })

  const lines = IstanbulArtifact.linesFrom(text)

  expect(lines.covered).toBe(8)
  expect(lines.total).toBe(10)
})

test('a coverage summary with no lines section yields no lines', () => {
  const text = JSON.stringify({ total: {} })

  const lines = IstanbulArtifact.linesFrom(text)

  expect(lines.covered).toBe(0)
  expect(lines.total).toBe(0)
})

test('a text that is not JSON is not a coverage summary and raises UnreadableArtifact', () => {
  const text = 'this is not json at all'

  expect(() => IstanbulArtifact.linesFrom(text)).toThrow(UnreadableArtifact)
})
