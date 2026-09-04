import { expect, test } from 'vitest'
import { LcovArtifact } from './lcov-artifact.js'
import { UnreadableArtifact } from './unreadable-artifact.js'

test('an lcov file adds up the LF and LH counters of every record', () => {
  const text = [
    'SF:src/one.ts',
    'LF:10',
    'LH:8',
    'end_of_record',
    'SF:src/two.ts',
    'LF:20',
    'LH:15',
    'end_of_record',
  ].join('\n')

  const lines = LcovArtifact.linesFrom(text)

  expect(lines.covered).toBe(23)
  expect(lines.total).toBe(30)
})

test('an lcov record with no LF counter yields no lines', () => {
  const text = ['SF:src/one.ts', 'end_of_record'].join('\n')

  const lines = LcovArtifact.linesFrom(text)

  expect(lines.covered).toBe(0)
  expect(lines.total).toBe(0)
})

test('a text with no SF record is not lcov and raises UnreadableArtifact', () => {
  const text = 'this is not an lcov file at all'

  expect(() => LcovArtifact.linesFrom(text)).toThrow(UnreadableArtifact)
})
