import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { createCache } from '../api/routes.js'
import { ArtifactFiles } from './artifact-files.js'
import { IstanbulArtifact } from './istanbul-artifact.js'
import type { CoverageReading } from './coverage-reading.js'

class CloneDirectory {
  private constructor(readonly path: string) {}

  static create(): CloneDirectory {
    return new CloneDirectory(mkdtempSync(join(tmpdir(), 'artifact-files-')))
  }

  write(relativePath: string, contents: string): string {
    const absolutePath = join(this.path, relativePath)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, contents)
    return absolutePath
  }

  cleanup(): void {
    rmSync(this.path, { recursive: true, force: true })
  }
}

class ArtifactContent {
  static istanbul(covered: number, total: number): string {
    return JSON.stringify({ total: { lines: { covered, total } } })
  }

  static istanbulWithNoLines(): string {
    return JSON.stringify({ total: {} })
  }

  static lcov(covered: number, total: number): string {
    return ['SF:src/one.ts', `LF:${total}`, `LH:${covered}`, 'end_of_record'].join('\n')
  }
}

let clone: CloneDirectory

afterEach(() => {
  clone.cleanup()
  vi.restoreAllMocks()
})

test('the coverage summary of a clone wins over its lcov file', async () => {
  clone = CloneDirectory.create()
  clone.write('coverage/coverage-summary.json', ArtifactContent.istanbul(90, 100))
  clone.write('coverage/lcov.info', ArtifactContent.lcov(10, 100))
  const artifacts = new ArtifactFiles(createCache<CoverageReading>(8))

  const reading = await artifacts.readingOf(clone.path)

  if (reading.state !== 'measured') throw new Error('expected a measured reading')
  expect(reading.source).toBe('istanbul')
  expect(reading.lines.percentage()).toBe(90)
})

test('a clone with only an lcov file at its root is measured from it', async () => {
  clone = CloneDirectory.create()
  clone.write('lcov.info', ArtifactContent.lcov(1, 4))
  const artifacts = new ArtifactFiles(createCache<CoverageReading>(8))

  const reading = await artifacts.readingOf(clone.path)

  if (reading.state !== 'measured') throw new Error('expected a measured reading')
  expect(reading.source).toBe('lcov')
  expect(reading.lines.percentage()).toBe(25)
})

test('a clone with no coverage artifact reads as no data instead of zero per cent', async () => {
  clone = CloneDirectory.create()
  const artifacts = new ArtifactFiles(createCache<CoverageReading>(8))

  const reading = await artifacts.readingOf(clone.path)

  expect(reading).toEqual({ state: 'no-artifact' })
})

test('an artifact with no lines is skipped and the next candidate answers', async () => {
  clone = CloneDirectory.create()
  clone.write('coverage/coverage-summary.json', ArtifactContent.istanbulWithNoLines())
  clone.write('coverage/lcov.info', ArtifactContent.lcov(3, 5))
  const artifacts = new ArtifactFiles(createCache<CoverageReading>(8))

  const reading = await artifacts.readingOf(clone.path)

  if (reading.state !== 'measured') throw new Error('expected a measured reading')
  expect(reading.source).toBe('lcov')
  expect(reading.lines.percentage()).toBe(60)
})

test('the measure date is the mtime of the artifact that was read', async () => {
  clone = CloneDirectory.create()
  const path = clone.write('lcov.info', ArtifactContent.lcov(1, 2))
  const measuredAt = new Date('2024-03-01T12:00:00.000Z')
  utimesSync(path, measuredAt, measuredAt)
  const artifacts = new ArtifactFiles(createCache<CoverageReading>(8))

  const reading = await artifacts.readingOf(clone.path)

  if (reading.state !== 'measured') throw new Error('expected a measured reading')
  expect(reading.measuredAt.toISOString()).toBe(measuredAt.toISOString())
})

test('a second read of an unchanged artifact does not parse it again', async () => {
  clone = CloneDirectory.create()
  clone.write('coverage/coverage-summary.json', ArtifactContent.istanbul(2, 4))
  const spy = vi.spyOn(IstanbulArtifact, 'linesFrom')
  const artifacts = new ArtifactFiles(createCache<CoverageReading>(8))

  await artifacts.readingOf(clone.path)
  await artifacts.readingOf(clone.path)

  expect(spy).toHaveBeenCalledTimes(1)
})

test('an artifact whose mtime moved is parsed again', async () => {
  clone = CloneDirectory.create()
  const path = clone.write('coverage/coverage-summary.json', ArtifactContent.istanbul(2, 4))
  const spy = vi.spyOn(IstanbulArtifact, 'linesFrom')
  const artifacts = new ArtifactFiles(createCache<CoverageReading>(8))
  await artifacts.readingOf(clone.path)
  const movedMtime = new Date('2030-01-01T00:00:00.000Z')
  utimesSync(path, movedMtime, movedMtime)

  await artifacts.readingOf(clone.path)

  expect(spy).toHaveBeenCalledTimes(2)
})
