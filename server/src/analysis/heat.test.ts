import { execFileSync } from 'node:child_process'
import { afterEach, expect, test } from 'vitest'
import { heatTree } from './heat.js'
import { walkHistory } from './index.js'
import { createRepoFixture } from '../testing/repo-fixture.js'
import type { RepoFixture } from '../testing/repo-fixture.js'

/** Fixed reference instant: the fixture dates are known and do not expire. */
const NOW = new Date('2026-08-13T12:00:00.000Z')

let fixture: RepoFixture | null = null

afterEach(() => {
  fixture?.cleanup()
  fixture = null
})

test('percent is over the main folder total', async () => {
  // 4 commits under src/ (checkout: 1, cart: 2, utils: 1) and 6 outside it:
  // 10 non-merge commits in total. `checkout` is touched by a single commit,
  // so its percent must be over the 4 of the main folder (25), not the 10 of
  // the whole repo.
  fixture = createRepoFixture({
    commits: [
      { date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/checkout/pay.ts'] },
      { date: '2026-07-21T09:00:00+00:00', email: 'ana@example.com', files: ['src/cart/add.ts'] },
      { date: '2026-07-22T09:00:00+00:00', email: 'bea@example.com', files: ['src/cart/remove.ts'] },
      { date: '2026-07-23T09:00:00+00:00', email: 'bea@example.com', files: ['src/utils/format.ts'] },
      { date: '2026-07-24T09:00:00+00:00', email: 'ana@example.com', files: ['README.md'] },
      { date: '2026-07-25T09:00:00+00:00', email: 'ana@example.com', files: ['lib/a.ts'] },
      { date: '2026-07-26T09:00:00+00:00', email: 'bea@example.com', files: ['lib/b.ts'] },
      { date: '2026-07-27T09:00:00+00:00', email: 'bea@example.com', files: ['docs/guide.md'] },
      { date: '2026-07-28T09:00:00+00:00', email: 'cris@example.com', files: ['Makefile'] },
      { date: '2026-07-29T09:00:00+00:00', email: 'cris@example.com', files: ['scripts/run.sh'] },
    ],
  })

  const heat = await heatTree(fixture.path, '12m', { now: NOW })

  expect(heat.mainFolder).toBe('src')
  expect(heat.commits).toBe(4)
  const checkout = heat.children.find((child) => child.name === 'checkout')
  expect(checkout).toMatchObject({ commits: 1, percent: 25 })

  // 'lib' is neither the main folder nor hangs from it: a valid level with no
  // children, not an error.
  const outside = await heatTree(fixture.path, '12m', { now: NOW, path: 'lib' })
  expect(outside.children).toEqual([])
})

test('percent stays over the main folder total when drilling down', async () => {
  // 5 commits touch src/ (checkout: 2, cart: 2, utils: 1): the main folder
  // total. Of those, only 2 touch src/checkout (its own, deeper-level total).
  // 'pay.ts' is touched by 1 of those 2 commits: the correct percent is
  // round(1/5*100) = 20, over the main folder total. Computing it over the
  // level's own total (2) instead would give round(1/2*100) = 50, so the two
  // are distinguishable and a mix-up turns this test red.
  fixture = createRepoFixture({
    commits: [
      { date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/checkout/pay.ts'] },
      { date: '2026-07-21T09:00:00+00:00', email: 'ana@example.com', files: ['src/checkout/refund.ts'] },
      { date: '2026-07-22T09:00:00+00:00', email: 'bea@example.com', files: ['src/cart/add.ts'] },
      { date: '2026-07-23T09:00:00+00:00', email: 'bea@example.com', files: ['src/cart/remove.ts'] },
      { date: '2026-07-24T09:00:00+00:00', email: 'cris@example.com', files: ['src/utils/format.ts'] },
    ],
  })

  const heat = await heatTree(fixture.path, '12m', {
    now: NOW,
    mainFolder: 'src',
    path: 'src/checkout',
  })

  expect(heat.mainFolder).toBe('src')
  expect(heat.path).toBe('src/checkout')
  // The level's own total (2) is exposed as `commits`, but must NOT be the
  // percentage base for its children.
  expect(heat.commits).toBe(2)
  const pay = heat.children.find((child) => child.name === 'pay.ts')
  expect(pay).toMatchObject({ commits: 1, percent: 20 })

  // A trailing slash (as the UI would build joining breadcrumb segments) must
  // resolve to the exact same level as the normalized path.
  const trailingSlash = await heatTree(fixture.path, '12m', {
    now: NOW,
    mainFolder: 'src',
    path: 'src/checkout/',
  })
  expect(trailingSlash).toEqual(heat)

  // Repeated slashes and a saved main folder with stray slashes normalize the
  // same way, without falling back to the automatic main folder.
  const stray = await heatTree(fixture.path, '12m', {
    now: NOW,
    mainFolder: '/src/',
    path: '//src//checkout//',
  })
  expect(stray).toEqual(heat)
})

test('the main folder total travels in the payload as the percent denominator', async () => {
  // 5 commits touch src/ (checkout: 2, cart: 2, utils: 1): the main folder
  // total, exposed as `mainFolderCommits`. Only 2 of those touch src/checkout
  // itself, exposed as `commits`. The two must differ, or this test would not
  // catch a mix-up between the level's own total and the main folder's: e.g.
  // a child touched by 1 of those 2 commits would read as 50% instead of the
  // correct 20% (1 of 5), a self-contradictory payload once `commits` (2) and
  // the percent base are both shown to the caller.
  fixture = createRepoFixture({
    commits: [
      { date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/checkout/pay.ts'] },
      { date: '2026-07-21T09:00:00+00:00', email: 'ana@example.com', files: ['src/checkout/refund.ts'] },
      { date: '2026-07-22T09:00:00+00:00', email: 'bea@example.com', files: ['src/cart/add.ts'] },
      { date: '2026-07-23T09:00:00+00:00', email: 'bea@example.com', files: ['src/cart/remove.ts'] },
      { date: '2026-07-24T09:00:00+00:00', email: 'cris@example.com', files: ['src/utils/format.ts'] },
    ],
  })

  const heat = await heatTree(fixture.path, '12m', {
    now: NOW,
    mainFolder: 'src',
    path: 'src/checkout',
  })

  expect(heat.mainFolderCommits).toBe(5)
  expect(heat.commits).toBe(2)
  expect(heat.mainFolderCommits).not.toBe(heat.commits)
})

test('the heat carries the HEAD sha, null without commits', async () => {
  fixture = createRepoFixture({
    commits: [{ date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts'] }],
  })

  // Read from the fixture repo itself: the sha is generated by git and must
  // not be hardcoded.
  const realHeadSha = execFileSync('git', ['-C', fixture.path, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()

  const heat = await heatTree(fixture.path, '12m', { now: NOW })
  expect(heat.headSha).toBe(realHeadSha)

  const empty = createRepoFixture()
  try {
    expect((await heatTree(empty.path, '12m', { now: NOW })).headSha).toBeNull()
  } finally {
    empty.cleanup()
  }
})

test('package-lock.json is in neither tree nor KPI', async () => {
  fixture = createRepoFixture({
    commits: [
      {
        date: '2026-07-20T09:00:00+00:00',
        email: 'ana@example.com',
        files: ['src/a.ts', 'src/package-lock.json'],
      },
    ],
  })

  const heat = await heatTree(fixture.path, '12m', { now: NOW })
  expect(heat.children.map((child) => child.name)).not.toContain('package-lock.json')
  expect(heat.children).toEqual([{ name: 'a.ts', kind: 'file', commits: 1, percent: 100 }])

  const analysis = await walkHistory(fixture.path, '12m', { now: NOW })
  expect(analysis.kpis.filesTouched).toBe(1)
})

test('main folder defaults to src, else root', async () => {
  const withSrc = createRepoFixture({
    commits: [{ date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts'] }],
  })
  const withoutSrc = createRepoFixture({
    commits: [{ date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['lib/a.ts'] }],
  })
  const empty = createRepoFixture()

  try {
    expect((await heatTree(withSrc.path, '12m', { now: NOW })).mainFolder).toBe('src')
    expect((await heatTree(withoutSrc.path, '12m', { now: NOW })).mainFolder).toBe('')

    const forEmpty = await heatTree(empty.path, '12m', { now: NOW })
    expect(forEmpty).toEqual({
      mainFolder: '',
      fallback: false,
      path: '',
      commits: 0,
      mainFolderCommits: 0,
      headSha: null,
      children: [],
    })
  } finally {
    withSrc.cleanup()
    withoutSrc.cleanup()
    empty.cleanup()
  }
})

test('a stale main folder falls back', async () => {
  fixture = createRepoFixture({
    commits: [{ date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts'] }],
  })

  // 'checkout' was saved as the main folder in an earlier layout that no
  // longer exists at HEAD: the automatic one ('src', since it is present)
  // takes over, and the caller is told about it via `fallback`.
  const heat = await heatTree(fixture.path, '12m', { now: NOW, mainFolder: 'checkout' })

  expect(heat.fallback).toBe(true)
  expect(heat.mainFolder).toBe('src')
})

test('children sort by commits, then name', async () => {
  // 'zeta.ts' is touched first and 'beta.ts' second, but both end up tied at
  // 2 commits: the tie must break by name, not by insertion order, so 'beta'
  // (2 commits) comes before 'zeta' (2 commits), and 'alpha' (1 commit) last.
  fixture = createRepoFixture({
    commits: [
      { date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/zeta.ts'] },
      { date: '2026-07-21T09:00:00+00:00', email: 'ana@example.com', files: ['src/zeta.ts'] },
      { date: '2026-07-22T09:00:00+00:00', email: 'ana@example.com', files: ['src/beta.ts'] },
      { date: '2026-07-23T09:00:00+00:00', email: 'ana@example.com', files: ['src/beta.ts'] },
      { date: '2026-07-24T09:00:00+00:00', email: 'ana@example.com', files: ['src/alpha.ts'] },
    ],
  })

  const heat = await heatTree(fixture.path, '12m', { now: NOW })

  expect(heat.children.map((child) => child.name)).toEqual(['beta.ts', 'zeta.ts', 'alpha.ts'])
})

test('a renamed file is a new path', async () => {
  // The MVP does not follow renames: the old path and the new path are two
  // independent children, each with its own commit count.
  fixture = createRepoFixture({
    commits: [
      { date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/old.ts'] },
      {
        date: '2026-07-21T09:00:00+00:00',
        email: 'ana@example.com',
        files: [],
        rename: { from: 'src/old.ts', to: 'src/new.ts' },
      },
    ],
  })

  const heat = await heatTree(fixture.path, '12m', { now: NOW })

  const byName = new Map(heat.children.map((child) => [child.name, child.commits]))
  // old.ts: added by the first commit, removed by the rename commit = 2.
  expect(byName.get('old.ts')).toBe(2)
  // new.ts: added by the rename commit only = 1.
  expect(byName.get('new.ts')).toBe(1)
})
