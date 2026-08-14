import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as analysis from '../analysis/index.js'
import { createApp } from '../app.js'
import { createCatalog } from '../repos.js'
import { createSettingsStore } from '../settings.js'
import { appendCommit, createRepoFixture, daysAgo } from '../testing/repo-fixture.js'
import { createCache } from './routes.js'
import type { AppDeps } from '../app.js'
import type { CommitFixture, FixtureSpec, RepoFixture } from '../testing/repo-fixture.js'

/**
 * Integration tests over `createApp(deps)`: the clones root, the settings file
 * and every clone live in `tmp`, and the analysis barrel travels through spies
 * that CALL THROUGH to the real thing — the payloads come from real git
 * history, the spies only count the calls the cache is supposed to save.
 */

/** Distinctive on purpose: the identity test looks for it in the payloads. */
const AUTHOR = 'distinctive.author@nowhere.invalid'

/**
 * 2 commits in the previous 30-day window and 4 in the current one, so the
 * trend is comparable (+100%), by 2 authors. The dates are relative to the run:
 * an absolute date would drift out of the window as real time passes.
 */
const COMMITS: readonly CommitFixture[] = [
  { date: daysAgo(50), email: AUTHOR, files: ['src/checkout/pay.ts'] },
  { date: daysAgo(40), email: AUTHOR, files: ['src/dashboard/panel.ts'] },
  { date: daysAgo(20), email: AUTHOR, files: ['src/checkout/pay.ts'] },
  { date: daysAgo(15), email: AUTHOR, files: ['src/checkout/cart/add.ts'] },
  { date: daysAgo(10), email: 'bea@example.com', files: ['src/dashboard/panel.ts'] },
  { date: daysAgo(5), email: 'bea@example.com', files: ['README.md', 'package-lock.json'] },
]

function spiesOverAnalysis() {
  return {
    readHeadSha: vi.fn(analysis.readHeadSha),
    readLastCommitAt: vi.fn(analysis.readLastCommitAt),
    walkHistory: vi.fn(analysis.walkHistory),
    heatTree: vi.fn(analysis.heatTree),
  }
}

interface World {
  root: string
  spies: ReturnType<typeof spiesOverAnalysis>
  deps: AppDeps
  /** A clone under the root, reachable as `name`. */
  clone(name: string, spec?: FixtureSpec): RepoFixture
  /** A directory under the root that is not a clone. */
  folder(name: string): string
  /** Deps over the SAME settings file with a new store and a new cache: a restart. */
  restart(): AppDeps
  cleanup(): void
}

function createWorld(): World {
  const dir = mkdtempSync(join(tmpdir(), 'repo-pulse-api-'))
  const root = join(dir, 'clones')
  mkdirSync(root)
  const spies = spiesOverAnalysis()
  const fixtures: RepoFixture[] = []
  // One fixed instant per test: every window and the freshness check hang off it.
  const now = new Date()
  const depsOverTheSameFiles = (): AppDeps => ({
    catalog: createCatalog(root, spies),
    settings: createSettingsStore(join(dir, 'settings.json')),
    analysis: spies,
    now: () => now,
  })

  return {
    root,
    spies,
    deps: depsOverTheSameFiles(),
    clone(name, spec = {}) {
      const fixture = createRepoFixture(spec)
      fixtures.push(fixture)
      // A symlinked clone counts: the catalog stats the child, it does not
      // trust the dirent (which reports a symlink as "not a directory").
      symlinkSync(fixture.path, join(root, name))
      return fixture
    },
    folder(name) {
      const path = join(root, name)
      mkdirSync(path)
      return path
    },
    restart: depsOverTheSameFiles,
    cleanup() {
      for (const fixture of fixtures) fixture.cleanup()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

let world: World

beforeEach(() => {
  world = createWorld()
})

afterEach(() => {
  world.cleanup()
})

/** What a `git fetch` leaves behind, which is all this server may read about it. */
function fetched(fixture: RepoFixture): void {
  writeFileSync(join(fixture.path, '.git', 'FETCH_HEAD'), '')
}

test('the same HEAD does not walk twice', async () => {
  world.clone('alpha', { commits: COMMITS })
  const app = createApp(world.deps)

  const first = await request(app).get('/api/repos/alpha/summary?window=30d')
  const second = await request(app).get('/api/repos/alpha/summary?window=30d')

  expect(first.status).toBe(200)
  expect(second.body).toEqual(first.body)
  expect(world.spies.walkHistory).toHaveBeenCalledTimes(1)
  // HEAD is read on every request: that is how the cache sees the clone advance.
  expect(world.spies.readHeadSha).toHaveBeenCalledTimes(2)
})

test('repos lists the clones', async () => {
  const alpha = world.clone('alpha', { commits: COMMITS })
  world.clone('empty')
  world.folder('not-a-clone')
  fetched(alpha)

  const response = await request(createApp(world.deps)).get('/api/repos')

  expect(response.status).toBe(200)
  // 'not-a-clone' has no '.git': it is not listed, though it can still be resolved.
  expect(response.body.repos.map((repo: { id: string }) => repo.id)).toEqual(['alpha', 'empty'])

  const [first, second] = response.body.repos
  // Exactly these fields, no more: nothing about an author may sneak into the list.
  expect(Object.keys(first)).toEqual(['id', 'name', 'path', 'lastCommitAt', 'fetchedAt'])
  expect(first).toMatchObject({ id: 'alpha', name: 'alpha', path: join(world.root, 'alpha') })
  expect(Date.parse(first.lastCommitAt)).toBe(Date.parse(COMMITS.at(-1)?.date ?? ''))
  expect(Date.parse(first.fetchedAt)).not.toBeNaN()
  // A clone with no commits and no fetch: two nulls, not two errors.
  expect(second).toMatchObject({ id: 'empty', lastCommitAt: null, fetchedAt: null })
})

test('summary carries pulse, people, trend, meta', async () => {
  world.clone('alpha', { commits: COMMITS })

  const response = await request(createApp(world.deps)).get('/api/repos/alpha/summary?window=30d')

  expect(response.status).toBe(200)
  const body = response.body
  expect(body).toMatchObject({ window: '30d', bucket: 'day' })
  expect(body.headSha).toMatch(/^[0-9a-f]{40}$/)

  // Pulse: one bucket per day of the window, holding the 4 commits inside it.
  expect(body.buckets).toHaveLength(30)
  const commitsPerBucket = body.buckets.map((bucket: { commits: number }) => bucket.commits)
  expect(commitsPerBucket.reduce((total: number, commits: number) => total + commits, 0)).toBe(4)

  // People: authors per bucket, and the concentration, both without a name.
  const withAuthors = body.buckets.filter((bucket: { authors: number }) => bucket.authors > 0)
  expect(withAuthors).toHaveLength(4)
  expect(body.concentration).toEqual({ authors: 2, percentage: 100 })
  expect(body.kpis).toEqual({ commits: 4, activeAuthors: 2, filesTouched: 4 })

  // Trend: the 2 commits of the equally long previous window against the 4 of this one.
  expect(body.previousWindowBuckets).toHaveLength(30)
  expect(body.trend).toEqual({
    comparable: true,
    percentage: 100,
    previousWindowCommits: 2,
    reason: null,
  })

  // Meta: this clone has never fetched, so there is no date and no warning.
  expect(body.meta).toEqual({ lastCommitAt: expect.any(String), fetchedAt: null, stale: false })
  expect(Date.parse(body.meta.lastCommitAt)).toBe(Date.parse(COMMITS.at(-1)?.date ?? ''))
})

test('heat lists only that level', async () => {
  world.clone('alpha', { commits: COMMITS })

  const response = await request(createApp(world.deps)).get(
    '/api/repos/alpha/heat?path=src/checkout',
  )

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({
    // No 'window' in the query: the default one.
    window: '12m',
    mainFolder: 'src',
    fallback: false,
    path: 'src/checkout',
    commits: 3,
    // The denominator behind every percent: the commits touching 'src'.
    mainFolderCommits: 5,
  })
  expect(response.body.children).toEqual([
    { name: 'pay.ts', kind: 'file', commits: 2, percent: 40 },
    { name: 'cart', kind: 'dir', commits: 1, percent: 20 },
  ])
  // Only that level: neither what hangs from 'cart' nor the sibling of 'checkout'.
  expect(JSON.stringify(response.body.children)).not.toContain('add.ts')
  expect(JSON.stringify(response.body.children)).not.toContain('dashboard')
})

test('settings survive a restart', async () => {
  world.clone('alpha', { commits: COMMITS })

  const saved = await request(createApp(world.deps))
    .put('/api/repos/alpha/settings')
    .send({ mainFolder: 'src/dashboard' })

  expect(saved.status).toBe(200)
  expect(saved.body).toEqual({ mainFolder: 'src/dashboard' })

  // A new store over the same file and a new cache: what a restarted server sees.
  const response = await request(createApp(world.restart())).get('/api/repos/alpha/heat')

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({
    mainFolder: 'src/dashboard',
    fallback: false,
    path: 'src/dashboard',
    mainFolderCommits: 2,
  })
  expect(response.body.children).toEqual([
    { name: 'panel.ts', kind: 'file', commits: 2, percent: 100 },
  ])
})

test('no .git is 422; no commits is 200', async () => {
  world.folder('not-a-clone')
  world.clone('empty')
  const app = createApp(world.deps)

  const notAClone = await request(app).get('/api/repos/not-a-clone/summary')
  const noCommits = await request(app).get('/api/repos/empty/summary')

  // A folder that is not a clone resolves, reaches git, and comes back typed.
  expect(notAClone.status).toBe(422)
  expect(notAClone.body).toEqual({
    error: { code: 'not-a-git-repo', message: expect.any(String) },
  })
  // A clone with no commits is a valid repo with an empty history, not an error.
  expect(noCommits.status).toBe(200)
  expect(noCommits.body.headSha).toBeNull()
  expect(noCommits.body.kpis).toEqual({ commits: 0, activeAuthors: 0, filesTouched: 0 })
  expect(noCommits.body.meta).toEqual({ lastCommitAt: null, fetchedAt: null, stale: false })
})

test('a new commit invalidates the cache', async () => {
  const alpha = world.clone('alpha', { commits: COMMITS })
  const app = createApp(world.deps)

  const before = await request(app).get('/api/repos/alpha/summary?window=30d')
  appendCommit(alpha.path, { date: daysAgo(1), email: AUTHOR, files: ['src/checkout/pay.ts'] })
  const after = await request(app).get('/api/repos/alpha/summary?window=30d')

  expect(before.body.kpis.commits).toBe(4)
  expect(after.body.kpis.commits).toBe(5)
  expect(after.body.headSha).not.toBe(before.body.headSha)
  expect(world.spies.walkHistory).toHaveBeenCalledTimes(2)
})

test('no author identity in the payload', async () => {
  const alpha = world.clone('alpha', { commits: COMMITS })
  fetched(alpha)
  const app = createApp(world.deps)

  const responses = await Promise.all([
    request(app).get('/api/repos'),
    request(app).get('/api/repos/alpha/summary?window=30d'),
    request(app).get('/api/repos/alpha/heat'),
  ])

  for (const response of responses) {
    expect(response.status).toBe(200)
    const serialized = JSON.stringify(response.body)
    expect(serialized).not.toContain(AUTHOR)
    expect(serialized).not.toContain('distinctive.author')
    expect(serialized).not.toContain('nowhere.invalid')
    // Nor the author NAME the fixture signs with.
    expect(serialized).not.toContain('Fixture Author')
  }
})

test('an unknown repo is 404, and so is an id that leaves the root', async () => {
  world.clone('alpha', { commits: COMMITS })
  const app = createApp(world.deps)

  const unknown = await request(app).get('/api/repos/ghost/summary')
  // '..%2f' arrives decoded as '../': the parent of the root IS a real
  // directory, so only the check on the id keeps it from being served.
  const outside = await request(app).get('/api/repos/..%2fetc/heat')
  // A '..' of its own never reaches the router: Express answers that one.
  const parent = await request(app).get('/api/repos/%2e%2e/summary')

  for (const response of [unknown, outside]) {
    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: { code: 'unknown-repo', message: expect.any(String) } })
  }
  expect(parent.status).toBe(404)
})

test('an unknown window is 400', async () => {
  world.clone('alpha', { commits: COMMITS })

  const response = await request(createApp(world.deps)).get('/api/repos/alpha/summary?window=7d')

  expect(response.status).toBe(400)
  expect(response.body).toEqual({ error: { code: 'invalid-window', message: expect.any(String) } })
  expect(world.spies.walkHistory).not.toHaveBeenCalled()
})

test('a body that is not { mainFolder: string } is 400', async () => {
  world.clone('alpha', { commits: COMMITS })
  const app = createApp(world.deps)

  const wrongType = await request(app).put('/api/repos/alpha/settings').send({ mainFolder: 42 })
  const malformed = await request(app)
    .put('/api/repos/alpha/settings')
    .set('Content-Type', 'application/json')
    .send('{ not json')

  for (const response of [wrongType, malformed]) {
    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: { code: 'invalid-body', message: expect.any(String) } })
  }
})

test('the empty main folder is legal and scopes the heat to the root', async () => {
  world.clone('alpha', { commits: COMMITS })
  const app = createApp(world.deps)

  const saved = await request(app).put('/api/repos/alpha/settings').send({ mainFolder: '' })
  const response = await request(app).get('/api/repos/alpha/heat')

  expect(saved.body).toEqual({ mainFolder: '' })
  expect(response.body).toMatchObject({ mainFolder: '', fallback: false, path: '' })
  expect(response.body.children).toEqual([
    { name: 'src', kind: 'dir', commits: 5, percent: 83 },
    { name: 'README.md', kind: 'file', commits: 1, percent: 17 },
  ])
})

test('the cache evicts the least recently used entry', async () => {
  const cache = createCache<{ of: string }>(2)
  const computed: string[] = []
  const remember = (key: string) =>
    cache.remember(key, () => {
      computed.push(key)
      return Promise.resolve({ of: key })
    })

  await remember('a')
  await remember('b')
  // Reading 'a' makes it the most recent one, so 'c' evicts 'b' and not 'a'.
  await remember('a')
  await remember('c')
  await remember('a')
  await remember('b')

  expect(computed).toEqual(['a', 'b', 'c', 'b'])
})
