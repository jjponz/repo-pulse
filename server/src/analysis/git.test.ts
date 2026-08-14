import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { AnalysisError, parseHistory, readDirectories, readHeadSha, readHistory } from './git.js'
import { createRepoFixture, nonMergeCommits } from '../testing/repo-fixture.js'
import type { CommitFixture, RepoFixture } from '../testing/repo-fixture.js'

const COMMITS: readonly CommitFixture[] = [
  { date: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts'] },
  { date: '2026-07-21T09:00:00+00:00', email: 'Ana@Example.com', files: ['src/b.ts'] },
  { date: '2026-07-22T09:00:00+00:00', email: 'bea@example.com', files: ['src/f.ts'] },
  { date: '2026-08-12T09:00:00+00:00', email: 'cris@example.com', files: ['src/i.ts'] },
]

const MERGE: CommitFixture = {
  date: '2026-08-12T10:00:00+00:00',
  email: 'dani@example.com',
  files: ['src/j.ts'],
}

let fixture: RepoFixture

beforeAll(() => {
  fixture = createRepoFixture({ commits: COMMITS, merge: MERGE })
})

afterAll(() => {
  fixture.cleanup()
})

test('readHistory returns the non-merge commits of HEAD with the email lowercased', async () => {
  const { headSha, commits } = await readHistory(fixture.path)

  expect(headSha).toMatch(/^[0-9a-f]{40}$/)
  expect(commits).toHaveLength(nonMergeCommits(fixture.path))
  expect(commits).toHaveLength(5)
  expect(new Set(commits.map((commit) => commit.author))).toEqual(
    new Set(['ana@example.com', 'bea@example.com', 'cris@example.com', 'dani@example.com']),
  )
})

test('readHistory includes the files of the root commit', async () => {
  const { commits } = await readHistory(fixture.path)

  expect(commits.at(-1)?.files).toEqual(['src/a.ts'])
})

test('readHistory does not C-quote non-ASCII paths', async () => {
  // By default git C-quotes non-ASCII paths in '--name-only' output: this
  // path would come back as the literal '"src/p\303\241ginas/uno.ts"'
  // (quotes included) instead of the raw UTF-8 path below.
  const accented = createRepoFixture({
    commits: [
      {
        date: '2026-07-20T09:00:00+00:00',
        email: 'ana@example.com',
        files: ['src/páginas/uno.ts'],
      },
    ],
  })

  try {
    const { commits } = await readHistory(accented.path)

    expect(commits[0]?.files).toEqual(['src/páginas/uno.ts'])
  } finally {
    accented.cleanup()
  }
})

test('readHistory unquotes paths that git C-quotes', async () => {
  // '"' and '\' trigger git's C-quoting UNCONDITIONALLY, unlike non-ASCII
  // bytes (which 'core.quotePath=false' alone spares): 'git log --name-only'
  // returns the literal '"src/quo\"te.ts"' and '"src/back\\slash.ts"' instead
  // of the raw paths below, while 'ls-tree -z' (used by `readDirectories`)
  // returns them raw. Written via the fixture's normal `files` mechanism:
  // both characters are ordinary bytes on the filesystem, so this needs no
  // special-cased git commands.
  const quoted = createRepoFixture({
    commits: [
      {
        date: '2026-07-20T09:00:00+00:00',
        email: 'ana@example.com',
        files: ['src/quo"te.ts', 'src/back\\slash.ts'],
      },
    ],
  })

  try {
    const { commits } = await readHistory(quoted.path)

    expect(commits[0]?.files).toHaveLength(2)
    expect(commits[0]?.files).toEqual(expect.arrayContaining(['src/quo"te.ts', 'src/back\\slash.ts']))
  } finally {
    quoted.cleanup()
  }
})

test('readHistory applies .mailmap', async () => {
  const withMailmap = createRepoFixture({
    commits: COMMITS,
    mailmap: 'Ana <ana@example.com> <bea@example.com>\n',
  })

  try {
    const { commits } = await readHistory(withMailmap.path)

    expect(new Set(commits.map((commit) => commit.author))).toEqual(
      new Set(['ana@example.com', 'cris@example.com']),
    )
  } finally {
    withMailmap.cleanup()
  }
})

test('a git repo without commits has no HEAD and no history', async () => {
  const empty = createRepoFixture()

  try {
    expect(await readHeadSha(empty.path)).toBeNull()
    expect(await readHistory(empty.path)).toEqual({ headSha: null, commits: [] })
  } finally {
    empty.cleanup()
  }
})

test('a git repo with a corrupt HEAD fails with the git-failed code, it does not return null', async () => {
  const corrupt = createRepoFixture({ commits: COMMITS })

  try {
    // 'rev-parse --verify --quiet HEAD' tells "no HEAD yet" (exit 1) from a real
    // failure by exit code. A HEAD that does not point at a valid ref makes git
    // exit 128 ("fatal: not a git repository"), not 1: it must propagate.
    writeFileSync(join(corrupt.path, '.git', 'HEAD'), 'this-is-not-a-valid-ref\n')

    await expect(readHeadSha(corrupt.path)).rejects.toThrow(AnalysisError)
    await expect(readHeadSha(corrupt.path)).rejects.toMatchObject({ code: 'git-failed' })
  } finally {
    corrupt.cleanup()
  }
})

test('a directory that is not a git repo fails with the not-a-git-repo code', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'repo-pulse-no-git-'))

  try {
    await expect(readHistory(directory)).rejects.toThrow(AnalysisError)
    await expect(readHistory(directory)).rejects.toMatchObject({ code: 'not-a-git-repo' })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('readDirectories lists dirs, not files', async () => {
  const withDirs = createRepoFixture({
    commits: [
      {
        date: '2026-07-20T09:00:00+00:00',
        email: 'ana@example.com',
        files: ['src/components/a.ts', 'lib/b.ts', 'README.md'],
      },
    ],
  })
  const empty = createRepoFixture()

  try {
    const directories = await readDirectories(withDirs.path)

    expect(new Set(directories)).toEqual(new Set(['src', 'src/components', 'lib']))
    expect(directories).not.toContain('README.md')

    // A repo without HEAD has no directories to list either.
    expect(await readDirectories(empty.path)).toEqual([])
  } finally {
    withDirs.cleanup()
    empty.cleanup()
  }
})

test('parseHistory reads the git log format with NUL and US separators', () => {
  const output =
    '\u0000abc\u001f2026-08-01T10:00:00Z\u001fAna@Example.com\nsrc/a.ts\n\n' +
    '\u0000def\u001f2026-07-31T10:00:00Z\u001fbea@example.com\n'

  expect(parseHistory(output)).toEqual([
    {
      sha: 'abc',
      date: Date.parse('2026-08-01T10:00:00Z'),
      author: 'ana@example.com',
      files: ['src/a.ts'],
    },
    {
      sha: 'def',
      date: Date.parse('2026-07-31T10:00:00Z'),
      author: 'bea@example.com',
      files: [],
    },
  ])
})
