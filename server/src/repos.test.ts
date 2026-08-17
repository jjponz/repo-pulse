import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as analysis from './analysis/index.js'
import { createCatalog, freshnessOf } from './repos.js'
import { createRepoFixture, daysAgo } from './testing/repo-fixture.js'
import type { FixtureSpec, RepoFixture } from './testing/repo-fixture.js'

const MS_PER_DAY = 86_400_000

/** Whole seconds: a filesystem may not keep the milliseconds of an mtime. */
const NOW = new Date(Math.floor(Date.now() / 1000) * 1000)

let root: string
let temporary: string
let fixtures: RepoFixture[]

beforeEach(() => {
  temporary = mkdtempSync(join(tmpdir(), 'repo-pulse-catalog-'))
  root = join(temporary, 'clones')
  mkdirSync(root)
  fixtures = []
})

afterEach(() => {
  for (const fixture of fixtures) fixture.cleanup()
  rmSync(temporary, { recursive: true, force: true })
  vi.restoreAllMocks()
})

/**
 * The catalog warns about what it degrades silently. A test that exercises one
 * of those paths captures the warning and asserts it instead of letting it
 * print: the suite's output stays clean AND the diagnostic stays pinned.
 */
function captureWarnings() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {})
}

/** A clone reachable as `name` under the root, through a symlink. */
function clone(name: string, spec: FixtureSpec = {}): RepoFixture {
  const fixture = createRepoFixture(spec)
  fixtures.push(fixture)
  symlinkSync(fixture.path, join(root, name))
  return fixture
}

test('the catalog lists only the children that are clones', async () => {
  clone('alpha', { commits: [{ date: daysAgo(2), email: 'ana@example.com', files: ['a.ts'] }] })
  clone('beta')
  mkdirSync(join(root, 'not-a-clone'))
  writeFileSync(join(root, 'notes.txt'), '')

  const clones = await createCatalog(root, analysis).list()

  // Sorted by name, and a symlinked clone counts: the catalog stats the child.
  expect(clones.map((repo) => repo.id)).toEqual(['alpha', 'beta'])
  expect(clones[0]).toEqual({
    id: 'alpha',
    name: 'alpha',
    path: join(root, 'alpha'),
    lastCommitAt: expect.any(String),
    fetchedAt: null,
    stale: false,
  })
  expect(clones[1]?.lastCommitAt).toBeNull()
})

test('the list carries the same staleness the summary reports', async () => {
  const fixture = clone('alpha')
  const fetchHead = join(fixture.path, '.git', 'FETCH_HEAD')
  writeFileSync(fetchHead, '')
  const longAgo = new Date(NOW.getTime() - 30 * MS_PER_DAY)
  utimesSync(fetchHead, longAgo, longAgo)

  const clones = await createCatalog(root, analysis, () => NOW).list()

  // Straight from `freshnessOf`, the one implementation of the 7-day rule: a
  // list view badging a stale photo does not re-derive it on the other side.
  expect(clones[0]).toMatchObject({ fetchedAt: longAgo.toISOString(), stale: true })
})

test('a clone git cannot read degrades to a null date, it does not sink the list', async () => {
  const broken = clone('broken', {
    commits: [{ date: daysAgo(2), email: 'ana@example.com', files: ['a.ts'] }],
  })
  clone('healthy', { commits: [{ date: daysAgo(1), email: 'ana@example.com', files: ['b.ts'] }] })
  // A HEAD that points nowhere makes git exit 128, not 1: without the guard
  // this would reject and take the whole list down with it.
  writeFileSync(join(broken.path, '.git', 'HEAD'), 'this-is-not-a-valid-ref\n')
  const warn = captureWarnings()

  const clones = await createCatalog(root, analysis).list()

  expect(clones.map((repo) => repo.id)).toEqual(['broken', 'healthy'])
  expect(clones[0]?.lastCommitAt).toBeNull()
  expect(clones[1]?.lastCommitAt).toEqual(expect.any(String))
  // Degraded, not silent: a broken clone must not read like an empty one.
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn.mock.calls[0]?.[0]).toContain(join(root, 'broken'))
})

test('a clones root that does not exist is an empty list, not a failure', async () => {
  const missing = join(temporary, 'nowhere')
  const warn = captureWarnings()

  const catalog = createCatalog(missing, analysis)

  expect(await catalog.list()).toEqual([])
  // The likeliest misconfiguration there is: it names the root it could not read.
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn.mock.calls[0]?.[0]).toContain(missing)
})

test('resolve returns any direct child, including one that is not a clone', async () => {
  clone('alpha')
  mkdirSync(join(root, 'not-a-clone'))
  const catalog = createCatalog(root, analysis)

  expect(await catalog.resolve('alpha')).toBe(join(root, 'alpha'))
  // This is what lets the analysis module answer with its own 'not-a-git-repo'
  // instead of the API pretending the folder does not exist.
  expect(await catalog.resolve('not-a-clone')).toBe(join(root, 'not-a-clone'))
})

test('resolve refuses anything that is not the plain name of a child', async () => {
  writeFileSync(join(root, 'notes.txt'), '')
  const catalog = createCatalog(root, analysis)

  for (const id of ['ghost', 'notes.txt', '', '.', '..', 'a/b', '../etc', 'a\\b']) {
    expect(await catalog.resolve(id)).toBeNull()
  }
})

test('freshnessOf has no date and no warning when the clone has never fetched', async () => {
  const fixture = clone('alpha')

  expect(await freshnessOf(fixture.path, NOW)).toEqual({ fetchedAt: null, stale: false })
})

test('freshnessOf declares stale only PAST seven days', async () => {
  const fixture = clone('alpha')
  const fetchHead = join(fixture.path, '.git', 'FETCH_HEAD')
  writeFileSync(fetchHead, '')

  const sevenDays = new Date(NOW.getTime() - 7 * MS_PER_DAY)
  utimesSync(fetchHead, sevenDays, sevenDays)

  expect(await freshnessOf(fixture.path, NOW)).toEqual({
    fetchedAt: sevenDays.toISOString(),
    stale: false,
  })

  const oneSecondMore = new Date(sevenDays.getTime() - 1000)
  utimesSync(fetchHead, oneSecondMore, oneSecondMore)

  expect(await freshnessOf(fixture.path, NOW)).toEqual({
    fetchedAt: oneSecondMore.toISOString(),
    stale: true,
  })
})
