import { readDirectories, readHistory } from './git.js'
import { isNoise } from './noise.js'
import { bucketIndex, buildGrid } from './windows.js'
import type { Commit, TimeWindow } from './types.js'

/** Directory used as the main folder when none is saved, when it exists at HEAD. */
const AUTO_MAIN_FOLDER = 'src'

export interface HeatEntry {
  name: string
  /** When a name is a file in one commit and a directory in another, 'dir' wins and the two histories merge into this single row. */
  kind: 'dir' | 'file'
  commits: number
  /** Over the main folder total (see `heatTree`). Percentages across children do NOT add up to 100: a commit touching three children counts once in each. */
  percent: number
}

export interface Heat {
  /** '' means the root. */
  mainFolder: string
  /** true when a saved `mainFolder` no longer exists at HEAD and the automatic one was used instead. */
  fallback: boolean
  /** level listed, from the root of the clone. */
  path: string
  /** commits of the window touching >=1 non-noise file under `path`. */
  commits: number
  /** commits of the window touching >=1 non-noise file under the main folder: the denominator behind every child's `percent` in `children`. */
  mainFolderCommits: number
  /** HEAD sha of the clone, null when the repo has no commits. */
  headSha: string | null
  children: HeatEntry[]
}

/**
 * Heat of a repo in a window: how many commits of the window touch each
 * immediate child of `path`, as a percentage of the commits that touch the
 * main folder (not of `path`'s own total, which may be a deeper level).
 *
 * `opts.mainFolder` is whatever is saved for the repo, if anything: a dead one
 * (no longer a directory at HEAD) falls back to the automatic one. `opts.path`
 * is the level to list, from the root of the clone, and defaults to the main
 * folder.
 */
export async function heatTree(
  repo: string,
  window: TimeWindow,
  opts: { mainFolder?: string; path?: string; now?: Date } = {},
): Promise<Heat> {
  const now = (opts.now ?? new Date()).getTime()
  const [directories, { headSha, commits }] = await Promise.all([readDirectories(repo), readHistory(repo)])

  const mainFolder = resolveMainFolder(directories, normalizePath(opts.mainFolder))
  const path = normalizePath(opts.path) ?? mainFolder.mainFolder

  const grid = buildGrid(
    window,
    now,
    commits.map((commit) => commit.date),
  )
  const inWindow = commits.filter((commit) => bucketIndex(grid, commit.date) !== null)

  const mainFolderCommits = countTouching(inWindow, mainFolder.mainFolder)
  const pathCommits = countTouching(inWindow, path)
  const children = isWithin(mainFolder.mainFolder, path)
    ? childrenOf(inWindow, path, mainFolderCommits)
    : []

  return { ...mainFolder, path, commits: pathCommits, mainFolderCommits, headSha, children }
}

/** Strips leading/trailing '/' and collapses repeated '/', so 'src/checkout/' and 'src/checkout' resolve to the same level. `undefined` passes through untouched. */
function normalizePath(path: string | undefined): string | undefined {
  return path === undefined ? undefined : path.split('/').filter((segment) => segment !== '').join('/')
}

/** Whether `path` is the main folder itself or hangs from it. The root ('') covers everything. */
function isWithin(mainFolder: string, path: string): boolean {
  return mainFolder === '' || path === mainFolder || path.startsWith(`${mainFolder}/`)
}

function resolveMainFolder(
  directories: readonly string[],
  saved: string | undefined,
): { mainFolder: string; fallback: boolean } {
  const auto = directories.includes(AUTO_MAIN_FOLDER) ? AUTO_MAIN_FOLDER : ''
  // '' (the root) always exists and is never "dead". Anything else must still
  // be a directory at HEAD, or it falls back to the automatic one.
  if (saved === undefined || saved === '' || directories.includes(saved)) {
    return { mainFolder: saved ?? auto, fallback: false }
  }
  return { mainFolder: auto, fallback: true }
}

function countTouching(commits: readonly Commit[], path: string): number {
  let count = 0
  for (const commit of commits) {
    if (commit.files.some((file) => !isNoise(file) && isUnder(path, file))) count += 1
  }
  return count
}

function childrenOf(commits: readonly Commit[], path: string, total: number): HeatEntry[] {
  const byName = new Map<string, { kind: 'dir' | 'file'; commits: Set<string> }>()

  for (const commit of commits) {
    const touched = new Map<string, 'dir' | 'file'>()
    for (const file of commit.files) {
      if (isNoise(file)) continue
      const child = childOf(path, file)
      if (child === null) continue
      if (touched.get(child.name) !== 'dir') touched.set(child.name, child.kind)
    }
    for (const [name, kind] of touched) {
      const entry = byName.get(name) ?? { kind, commits: new Set<string>() }
      if (kind === 'dir') entry.kind = 'dir'
      entry.commits.add(commit.sha)
      byName.set(name, entry)
    }
  }

  const entries = [...byName.entries()].map(([name, entry]) => ({
    name,
    kind: entry.kind,
    commits: entry.commits.size,
    percent: total === 0 ? 0 : Math.round((entry.commits.size / total) * 100),
  }))

  // Plain '<'/'>' compares by UTF-16 code unit, not `localeCompare`'s
  // ICU-driven, locale-dependent collation: the tie-break order must not
  // change between machines with a different `LANG`.
  return entries.sort((a, b) => b.commits - a.commits || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

/** Immediate child of `path` that `file` belongs to, or null when it is not under `path`. */
function childOf(path: string, file: string): { name: string; kind: 'dir' | 'file' } | null {
  const relative = relativeTo(path, file)
  if (relative === null || relative === '') return null
  const slash = relative.indexOf('/')
  return slash === -1
    ? { name: relative, kind: 'file' }
    : { name: relative.slice(0, slash), kind: 'dir' }
}

function isUnder(path: string, file: string): boolean {
  return path === '' || file === path || file.startsWith(`${path}/`)
}

function relativeTo(path: string, file: string): string | null {
  if (path === '') return file
  if (file === path) return ''
  if (file.startsWith(`${path}/`)) return file.slice(path.length + 1)
  return null
}
