import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
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
 * in the repo that runs git.
 */
export function createCatalog(
  root: string,
  port: Pick<typeof analysis, 'readLastCommitAt'>,
): Catalog {
  return {
    async list() {
      const clones: Clone[] = []
      // Sorted by code unit, not by `localeCompare`: the order of the list must
      // not change between machines with a different `LANG`.
      for (const name of (await children(root)).sort()) {
        const path = join(root, name)
        if (!(await isDirectory(path)) || !(await exists(join(path, '.git')))) continue
        clones.push({
          id: name,
          name,
          path,
          // One broken clone degrades to a null date; it does not sink the list.
          lastCommitAt: await port.readLastCommitAt(path).catch(() => null),
          fetchedAt: (await fetchedAtOf(path))?.toISOString() ?? null,
        })
      }
      return clones
    },

    async resolve(id) {
      if (!isPlainName(id)) return null
      const path = join(root, id)
      return (await isDirectory(path)) ? path : null
    },
  }
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
  try {
    return (await stat(join(repo, '.git', 'FETCH_HEAD'))).mtime
  } catch {
    return null
  }
}

/** A root that does not exist yet is an empty catalog, not a failure. */
async function children(root: string): Promise<string[]> {
  try {
    return await readdir(root)
  } catch {
    return []
  }
}

/** `stat`, not the dirent: it follows symlinks, so a symlinked clone counts. */
async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/** '.git' is a directory in a plain clone and a FILE in a worktree: both count. */
async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * A repo id is the plain name of a direct child of the root: a separator or a
 * '..' would point outside it, and outside it there is nothing to serve.
 */
function isPlainName(id: string): boolean {
  if (id === '' || id === '.' || id === '..') return false
  return !id.includes('/') && !id.includes('\\')
}
