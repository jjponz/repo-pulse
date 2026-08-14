import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { appendCommit, createRepoFixture, daysAgo, headShaOf, nonMergeCommits } from './repo-fixture.js'
import type { RepoFixture } from './repo-fixture.js'

let fixture: RepoFixture | null = null

afterEach(() => {
  fixture?.cleanup()
  fixture = null
})

test('createRepoFixture creates a git repo with the requested commits and the merge does not count', () => {
  fixture = createRepoFixture({
    commits: [
      { date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts'] },
      { date: '2026-07-21T09:00:00+00:00', email: 'bea@example.com', files: ['src/b.ts'] },
    ],
    merge: { date: '2026-07-22T09:00:00+00:00', email: 'cris@example.com', files: ['src/c.ts'] },
  })

  expect(existsSync(join(fixture.path, '.git'))).toBe(true)
  expect(nonMergeCommits(fixture.path)).toBe(3)
})

test('createRepoFixture pins the author and committer date to the one requested in each CommitFixture', () => {
  const commits = [
    { date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts'] },
    { date: '2026-07-21T15:30:00+02:00', email: 'bea@example.com', files: ['src/b.ts'] },
  ]
  fixture = createRepoFixture({ commits })

  // git ships no runner of its own: we read the dates with git directly.
  const output = execFileSync('git', ['-C', fixture.path, 'log', '--pretty=format:%aI%x09%cI'], {
    encoding: 'utf8',
  })
  const lines = output.trim().split('\n')
  expect(lines).toHaveLength(commits.length)

  // %aI normalises the offset (e.g. '+00:00' comes back as 'Z'): we compare
  // instants, not strings. The order of `git log` does not matter: we compare
  // the sorted sets of instants.
  const expectedInstants = commits.map((commit) => Date.parse(commit.date)).sort()
  const authorInstants = lines.map((line) => Date.parse(line.split('\t')[0] ?? '')).sort()
  const committerInstants = lines.map((line) => Date.parse(line.split('\t')[1] ?? '')).sort()

  expect(authorInstants).toEqual(expectedInstants)
  expect(committerInstants).toEqual(expectedInstants)
})

test('createRepoFixture without commits leaves an empty git repo', () => {
  fixture = createRepoFixture()

  expect(existsSync(join(fixture.path, '.git'))).toBe(true)
  expect(existsSync(join(fixture.path, 'src'))).toBe(false)
})

test('a rename names both paths', () => {
  fixture = createRepoFixture({
    commits: [
      { date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['old.txt'] },
      {
        date: '2026-07-21T09:00:00+00:00',
        email: 'ana@example.com',
        files: [],
        rename: { from: 'old.txt', to: 'new.txt' },
      },
    ],
  })

  // readHistory (git.ts) reads `--no-renames`: a rename commit must name BOTH
  // the old and the new path, exactly like a plain git repo would.
  const output = execFileSync(
    'git',
    ['-C', fixture.path, 'log', '--no-renames', '--name-only', '--pretty=format:', '-1'],
    { encoding: 'utf8' },
  )
  const paths = output.split('\n').filter((line) => line !== '')

  expect(new Set(paths)).toEqual(new Set(['old.txt', 'new.txt']))
})

test('daysAgo is that many days before the moment of the call, with an explicit offset', () => {
  const before = Date.now()
  const date = daysAgo(3)
  const after = Date.now()

  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000\+00:00$/)
  const parsed = Date.parse(date)
  const threeDays = 3 * 86_400_000
  // The date is truncated to whole seconds (git stores no more), so the lower
  // bound gets a second of slack.
  expect(parsed).toBeGreaterThanOrEqual(before - threeDays - 1000)
  expect(parsed).toBeLessThanOrEqual(after - threeDays)
})

test('appendCommit adds a commit on top of an existing fixture and moves HEAD', () => {
  fixture = createRepoFixture({
    commits: [{ date: daysAgo(2), email: 'ana@example.com', files: ['src/a.ts'] }],
  })
  const before = headShaOf(fixture.path)

  appendCommit(fixture.path, { date: daysAgo(1), email: 'bea@example.com', files: ['src/b.ts'] })

  expect(nonMergeCommits(fixture.path)).toBe(2)
  expect(headShaOf(fixture.path)).not.toBe(before)
})

test('cleanup removes the fixture directory', () => {
  const created = createRepoFixture({
    commits: [{ date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['a.txt'] }],
  })
  const path = created.path

  created.cleanup()

  expect(existsSync(path)).toBe(false)
})
