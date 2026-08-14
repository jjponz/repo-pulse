import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Throwaway git repos in `tmp`, with pinned author and committer dates. The
 * analysis tests NEVER run against real clones on the machine.
 */

/** Isolates global and system config: no hooks, no templates, no dev gpg signing. */
const ISOLATED_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
}

export interface CommitFixture {
  /** author and committer date, ISO 8601 with an explicit offset */
  date: string
  /** author email verbatim, so uppercase and `.mailmap` can be exercised */
  email: string
  /** paths to create in that commit, with content different from the previous; may be empty when `rename` covers the whole commit */
  files: readonly string[]
  /** `git mv` run before `files` is written, so the commit's diff names both the old and the new path */
  rename?: { from: string; to: string }
  message?: string
}

export interface FixtureSpec {
  commits?: readonly CommitFixture[]
  /**
   * When present, a branch is created with THAT commit and merged into main with
   * `--no-ff`: the branch commit counts, the merge commit must NOT be counted.
   */
  merge?: CommitFixture
  /** literal `.mailmap` content; written last and NOT committed */
  mailmap?: string
}

export interface RepoFixture {
  path: string
  cleanup(): void
}

export function createRepoFixture(spec: FixtureSpec = {}): RepoFixture {
  const path = mkdtempSync(join(tmpdir(), 'repo-pulse-fixture-'))

  try {
    git(path, ['init', '-q', '-b', 'main', '.'])
    git(path, ['config', 'user.name', 'Fixture'])
    git(path, ['config', 'user.email', 'fixture@example.com'])
    git(path, ['config', 'commit.gpgsign', 'false'])

    for (const commit of spec.commits ?? []) writeCommit(path, commit)

    const merge = spec.merge
    if (merge !== undefined) {
      git(path, ['checkout', '-q', '-b', 'fixture-branch'])
      writeCommit(path, merge)
      git(path, ['checkout', '-q', 'main'])
      git(path, ['merge', '--no-ff', '-q', 'fixture-branch', '-m', 'fixture merge'], envFor(merge))
    }

    if (spec.mailmap !== undefined) {
      writeFileSync(join(path, '.mailmap'), spec.mailmap)
    }
  } catch (error) {
    rmSync(path, { recursive: true, force: true })
    throw error
  }

  return {
    path,
    cleanup: () => {
      rmSync(path, { recursive: true, force: true })
    },
  }
}

/** Non-merge commits reachable from HEAD according to git: the number the tests compare against. */
export function nonMergeCommits(path: string): number {
  return Number(git(path, ['rev-list', '--no-merges', '--count', 'HEAD']).trim())
}

/** HEAD sha of the fixture repo, read through the same isolated env as the rest of this file. */
export function headShaOf(path: string): string {
  return git(path, ['rev-parse', 'HEAD']).trim()
}

function writeCommit(path: string, commit: CommitFixture): void {
  if (commit.rename !== undefined) {
    const { from, to } = commit.rename
    // `git mv` does not create the destination directory itself.
    mkdirSync(dirname(join(path, to)), { recursive: true })
    git(path, ['mv', from, to])
  }
  for (const file of commit.files) {
    const target = join(path, file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, `${commit.date} ${file}\n`)
  }
  git(path, ['add', '-A'])
  git(path, ['commit', '-q', '-m', commit.message ?? `commit ${commit.date}`], envFor(commit))
}

function envFor(commit: CommitFixture): NodeJS.ProcessEnv {
  return {
    GIT_AUTHOR_DATE: commit.date,
    GIT_COMMITTER_DATE: commit.date,
    GIT_AUTHOR_NAME: 'Fixture Author',
    GIT_AUTHOR_EMAIL: commit.email,
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.com',
  }
}

function git(path: string, args: readonly string[], env: NodeJS.ProcessEnv = {}): string {
  return execFileSync('git', ['-C', path, ...args], {
    encoding: 'utf8',
    env: { ...ISOLATED_ENV, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
