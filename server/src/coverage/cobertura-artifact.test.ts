import { expect, test } from 'vitest'
import { CoberturaArtifact } from './cobertura-artifact.js'
import { UnreadableArtifact } from './unreadable-artifact.js'

test('a cobertura report reads lines-valid and lines-covered of its root element', () => {
  const text = '<?xml version="1.0"?><coverage lines-covered="8" lines-valid="10"></coverage>'

  const lines = CoberturaArtifact.linesFrom(text)

  expect(lines.covered).toBe(8)
  expect(lines.total).toBe(10)
})

test('a cobertura report with no line attributes yields no lines', () => {
  const text = '<?xml version="1.0"?><coverage></coverage>'

  const lines = CoberturaArtifact.linesFrom(text)

  expect(lines.covered).toBe(0)
  expect(lines.total).toBe(0)
})

test('a text with no coverage element is not cobertura and raises UnreadableArtifact', () => {
  const text = '<?xml version="1.0"?><notCoverage></notCoverage>'

  expect(() => CoberturaArtifact.linesFrom(text)).toThrow(UnreadableArtifact)
})
