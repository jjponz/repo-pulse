import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Stats } from 'node:fs'
import type * as analysis from './analysis/index.js'

/**
 * The catalog of clones: the direct children of the configured root, with no
 * recursion, and the freshness of the photo each one holds. Nothing here writes
 * into a clone.
 */

/** Days without fetching after which a clone's photo is declared stale. */
const STALE_AFTER_DAYS = 7

const MS_PER_DAY = 86_400_000

export interface Clone {
  /** Folder name under the root, which is also the id of the repo in the API. */
  id: string
  name: string
  /** Absolute path of the clone. */
  path: string
  /** Author date of its newest commit, null when it has none or git could not be read. */
  lastCommitAt: string | null
  /** When the clone was last fetched, null when it never was. */
  fetchedAt: string | null
  /**
   * Whether that photo is stale, by the same rule `/summary` reports in its
   * `meta`: it comes from `freshnessOf`, so the 7-day threshold has exactly one
   * implementation and the UI never has to re-derive it.
   */
  stale: boolean
}

export interface Freshness {
  /** mtime of '.git/FETCH_HEAD' in ISO 8601, null when the clone has never fetched. */
  fetchedAt: string | null
  /** true when the last fetch is MORE than 7 days old; exactly 7 days is not stale. */
  stale: boolean
}

export interface Catalog {
  /** The children of the root that are clones, by name. */
  list(): Promise<Clone[]>
  /**
   * Path of the direct child of the root named `id`, even when it is not a
   * clone — that is what lets the analysis module answer with its own typed
   * `not-a-git-repo`. null when there is no such child, or when the id is not
   * the plain name of one.
   */
  resolve(id: string): Promise<string | null>
}

/**
 * `port` is the slice of the analysis barrel the catalog needs: the only code
 * in the repo that runs git. `now` is the instant the freshness of every photo
 * is measured against — the same one the rest of the API hangs off.
 */
export function createCatalog(
  root: string,
  port: Pick<typeof analysis, 'readLastCommitAt'>,
  now: () => Date = () => new Date(),
): Catalog {
  /** The entry for the child `name`, or null when that child is not a clone. */
  async function cloneAt(name: string, at: Date): Promise<Clone | null> {
    const path = join(root, name)
    if (!(await isDirectory(path)) || !(await exists(join(path, '.git')))) return null
    const [lastCommitAt, freshness] = await Promise.all([
      // One broken clone degrades to a null date; it does not sink the list. It
      // is warned about, though: without a trace, a clone whose git cannot be
      // read looks exactly like one with no commits.
      port.readLastCommitAt(path).catch((error: unknown) => {
        console.warn(`repo-pulse: cannot read the last commit of ${path}: ${reasonOf(error)}`)
        return null
      }),
      freshnessOf(path, at),
    ])
    return { id: name, name, path, lastCommitAt, ...freshness }
  }

  return {
    async list() {
      const at = now()
      // Every clone is read in parallel: each one costs a handful of stats and
      // two git processes, and one after another they would turn the first
      // request the dashboard makes — the one endpoint with no cache behind
      // it — into hundreds of round trips in a row over a root with dozens of
      // clones. The entries do not depend on each other.
      const clones = await Promise.all((await children(root)).map((name) => cloneAt(name, at)))
      return clones.filter((clone) => clone !== null).sort(byName)
    },

    async resolve(id) {
      if (!isPlainName(id)) return null
      const path = join(root, id)
      return (await isDirectory(path)) ? path : null
    },
  }
}

/**
 * Order of the list: by name, compared by code unit and not by `localeCompare`,
 * so it does not change between machines with a different `LANG`. It is applied
 * once the entries are built, because they are built out of order.
 */
function byName(one: Clone, other: Clone): number {
  if (one.name === other.name) return 0
  return one.name < other.name ? -1 : 1
}

/**
 * How old the photo of `repo` is: the mtime of '.git/FETCH_HEAD', which is the
 * only trace a `git fetch` leaves that this server is allowed to read. A clone
 * that has never fetched has no date and is not warned about.
 */
export async function freshnessOf(repo: string, now: Date): Promise<Freshness> {
  const fetchedAt = await fetchedAtOf(repo)
  if (fetchedAt === null) return { fetchedAt: null, stale: false }
  return {
    fetchedAt: fetchedAt.toISOString(),
    stale: now.getTime() - fetchedAt.getTime() > STALE_AFTER_DAYS * MS_PER_DAY,
  }
}

async function fetchedAtOf(repo: string): Promise<Date | null> {
  return (await statOrNull(join(repo, '.git', 'FETCH_HEAD')))?.mtime ?? null
}

/**
 * `stat` of a path that may not be there, or may not be readable, as null. The
 * three questions this file asks the filesystem — is it a directory, is it
 * there at all, when was it last written — are all this same call, and a `stat`
 * that throws answers "no" to every one of them.
 */
async function statOrNull(path: string): Promise<Stats | null> {
  try {
    return await stat(path)
  } catch {
    return null
  }
}

/**
 * A root that does not exist yet is an empty catalog, not a failure — but it is
 * warned about: an unreadable or mistyped `REPO_PULSE_ROOT` is the likeliest
 * misconfiguration there is, and it presents as "no clones at all".
 */
async function children(root: string): Promise<string[]> {
  try {
    return await readdir(root)
  } catch (error) {
    console.warn(`repo-pulse: cannot read the clones root ${root}: ${reasonOf(error)}`)
    return []
  }
}

/** What to put in a warning: the message of an `Error`, anything else as it is. */
function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** `stat`, not the dirent: it follows symlinks, so a symlinked clone counts. */
async function isDirectory(path: string): Promise<boolean> {
  return (await statOrNull(path))?.isDirectory() ?? false
}

/** '.git' is a directory in a plain clone and a FILE in a worktree: both count. */
async function exists(path: string): Promise<boolean> {
  return (await statOrNull(path)) !== null
}

/**
 * A repo id is the plain name of a direct child of the root: a separator or a
 * '..' would point outside it, and outside it there is nothing to serve.
 */
function isPlainName(id: string): boolean {
  if (id === '' || id === '.' || id === '..') return false
  return !id.includes('/') && !id.includes('\\')
}
