import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { createRepoFixture, nonMergeCommits } from './repo-fixture.js'
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

test('cleanup removes the fixture directory', () => {
  const created = createRepoFixture({
    commits: [{ date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['a.txt'] }],
  })
  const path = created.path

  created.cleanup()

  expect(existsSync(path)).toBe(false)
})
