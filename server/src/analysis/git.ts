import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Commit } from './types.js'

const run = promisify(execFile)

/** Largest 'git log' output we accept in memory (repos with tens of thousands of commits). */
const MAX_OUTPUT = 64 * 1024 * 1024

const RECORD_SEPARATOR = '\u0000'
const FIELD_SEPARATOR = '\u001f'

/**
 * '%aI' = author date in strict ISO 8601. '%aE' = author email WITH '.mailmap'
 * applied; '%ae' (lowercase) does not apply it, which is why it is not used.
 */
const FORMAT = '%x00%H%x1f%aI%x1f%aE'

/**
 * '--no-merges': merges are not work. '--no-renames': a rename is a new path.
 * '--root': without it, the root commit's files would not show up.
 */
const LOG_ARGS: readonly string[] = [
  'log',
  'HEAD',
  '--no-merges',
  '--no-renames',
  '--root',
  `--pretty=format:${FORMAT}`,
  '--name-only',
]

export type AnalysisErrorCode = 'not-a-git-repo' | 'git-failed'

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode
  /** Exit code of the git process behind the failure, or null when it does not come from a process (e.g. the binary is missing). */
  readonly exitCode: number | null

  constructor(code: AnalysisErrorCode, message: string, exitCode: number | null = null) {
    super(message)
    this.name = 'AnalysisError'
    this.code = code
    this.exitCode = exitCode
  }
}

export interface History {
  /** HEAD sha, or null when the repo has no commits */
  headSha: string | null
  /** non-merge commits reachable from HEAD, newest first */
  commits: Commit[]
}

export async function readHistory(repo: string): Promise<History> {
  const headSha = await readHeadSha(repo)
  if (headSha === null) return { headSha: null, commits: [] }
  return { headSha, commits: parseHistory(await git(repo, LOG_ARGS)) }
}

/**
 * HEAD sha without walking the history: it is the third leg of the cache key
 * (repo, window, HEAD sha), and this module is the only one that runs git.
 */
export async function readHeadSha(repo: string): Promise<string | null> {
  ensureGitRepo(repo)
  try {
    // '--verify --quiet' tells "no HEAD yet" (1) from a real failure (128 or
    // other) by exit code: with a plain 'rev-parse HEAD' both cases exited 128
    // and were indistinguishable.
    return (await git(repo, ['rev-parse', '--verify', '--quiet', 'HEAD'])).trim()
  } catch (error) {
    // A freshly initialised git repo has no HEAD yet (exit 1): that is not a failure.
    if (error instanceof AnalysisError && error.exitCode === 1) return null
    throw error
  }
}

/**
 * Every directory of the HEAD tree, relative to `repo`, recursive. Used to
 * auto-detect the main folder and to validate a saved one: like `readHistory`,
 * it short-circuits on "no HEAD" instead of letting the `ls-tree` failure
 * (exit 128) escape.
 */
export async function readDirectories(repo: string): Promise<string[]> {
  const headSha = await readHeadSha(repo)
  if (headSha === null) return []
  const output = await git(repo, ['ls-tree', '-d', '-r', '--name-only', '-z', 'HEAD'])
  return output.split(RECORD_SEPARATOR).filter((line) => line !== '')
}

export function parseHistory(output: string): Commit[] {
  const commits: Commit[] = []
  for (const record of output.split(RECORD_SEPARATOR)) {
    if (record.trim() === '') continue
    const lines = record.split('\n')
    const [sha, isoDate, email] = (lines[0] ?? '').split(FIELD_SEPARATOR)
    if (sha === undefined || isoDate === undefined || email === undefined) continue
    const date = Date.parse(isoDate)
    if (Number.isNaN(date)) continue
    commits.push({
      sha,
      date,
      author: email.trim().toLowerCase(),
      files: lines.slice(1).filter((line) => line !== ''),
    })
  }
  return commits
}

function ensureGitRepo(repo: string): void {
  if (!existsSync(join(repo, '.git'))) {
    throw new AnalysisError('not-a-git-repo', `${repo} is not a git repository: no .git found`)
  }
}

/** Read-only: this module never fetches, pulls or writes into the clone. */
async function git(repo: string, args: readonly string[]): Promise<string> {
  try {
    // 'core.quotePath=false': by default git C-quotes non-ASCII paths in
    // '--name-only' output (e.g. 'src/páginas/uno.ts' becomes the literal
    // '"src/p\303\241ginas/uno.ts"'), while 'ls-tree -z' never does. Forcing it
    // off keeps every path this module returns raw and consistent, which
    // `heat.ts`'s prefix matching and `isNoise` both rely on.
    const { stdout } = await run('git', ['-C', repo, '-c', 'core.quotePath=false', ...args], {
      encoding: 'utf8',
      maxBuffer: MAX_OUTPUT,
    })
    return stdout
  } catch (error) {
    throw new AnalysisError(
      'git-failed',
      `git ${args.join(' ')} failed in ${repo}: ${String(error)}`,
      exitCodeOf(error),
    )
  }
}

/**
 * `execFile`'s rejection exposes the exit code in `.code`: a number when the
 * process did terminate, or a string (e.g. 'ENOENT') when it never started.
 */
function exitCodeOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  const { code } = error
  return typeof code === 'number' ? code : null
}
