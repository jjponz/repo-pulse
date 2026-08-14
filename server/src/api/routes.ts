import { Router } from 'express'
import { DEFAULT_WINDOW, WINDOWS, isTimeWindow } from '../analysis/index.js'
import { freshnessOf } from '../repos.js'
import { ApiError } from './errors.js'
import type { Analysis, Heat, TimeWindow } from '../analysis/index.js'
import type { AppDeps } from '../app.js'
import type { Catalog } from '../repos.js'

/**
 * The four endpoints of the API, mounted under '/api'. Everything they read
 * comes from the analysis barrel through `deps.analysis`; nothing here runs git
 * or writes into a clone.
 *
 * Walking the history of a big clone is the expensive part, so each answer is
 * cached under the HEAD sha it was computed from. HEAD itself is read on EVERY
 * request — cheap, and it is what makes the cache notice that the clone moved.
 */

/** Entries kept per cache: enough for every window of every clone of a root. */
const CACHE_LIMIT = 64

export function createRouter(deps: AppDeps): Router {
  const router = Router()
  const summaries = createCache<Analysis>(CACHE_LIMIT)
  const heats = createCache<Heat>(CACHE_LIMIT)

  router.get('/repos', async (_request, response) => {
    response.json({ repos: await deps.catalog.list() })
  })

  router.get('/repos/:id/summary', async (request, response) => {
    const repo = await resolveRepo(deps.catalog, request.params.id)
    const window = windowOf(request.query.window)
    const now = deps.now()
    const headSha = await deps.analysis.readHeadSha(repo)
    const summary = await summaries.remember(keyOf([repo, window, headSha]), () =>
      deps.analysis.walkHistory(repo, window, { now }),
    )
    // The meta is NOT cached: it is a cheap read and the staleness warning has
    // to keep moving even while the analysis behind it stays valid.
    const [lastCommitAt, freshness] = await Promise.all([
      deps.analysis.readLastCommitAt(repo),
      freshnessOf(repo, now),
    ])

    response.json({ ...summary, meta: { lastCommitAt, ...freshness } })
  })

  router.get('/repos/:id/heat', async (request, response) => {
    const id = request.params.id
    const repo = await resolveRepo(deps.catalog, id)
    const window = windowOf(request.query.window)
    // The main folder comes from the settings store, never from the query.
    const mainFolder = deps.settings.get(id)?.mainFolder
    const path = pathOf(request.query.path)
    const now = deps.now()
    const headSha = await deps.analysis.readHeadSha(repo)
    const heat = await heats.remember(keyOf([repo, window, headSha, mainFolder, path]), () =>
      deps.analysis.heatTree(repo, window, { mainFolder, path, now }),
    )

    response.json({ window, ...heat })
  })

  router.put('/repos/:id/settings', async (request, response) => {
    const id = request.params.id
    // A folder that is not under the root has no settings to save.
    await resolveRepo(deps.catalog, id)
    const mainFolder = mainFolderOf(request.body)
    await deps.settings.set(id, { mainFolder })

    response.json({ mainFolder })
  })

  return router
}

export interface Cache<T> {
  /** The value cached under `key`, or the one `compute` produces, stored as the most recent. */
  remember(key: string, compute: () => Promise<T>): Promise<T>
}

/**
 * LRU bounded to `limit` entries. A `Map` iterates in insertion order, so
 * re-inserting a hit moves it to the end and the first key is always the least
 * recently used one.
 *
 * Values are stored resolved, never as promises: two identical requests in
 * flight at the same time both compute (a bounded waste) and no rejection is
 * ever cached, which is the trade the other way round.
 */
export function createCache<T extends object>(limit: number): Cache<T> {
  const entries = new Map<string, T>()

  return {
    async remember(key, compute) {
      const hit = entries.get(key)
      if (hit !== undefined) {
        entries.delete(key)
        entries.set(key, hit)
        return hit
      }
      const value = await compute()
      entries.set(key, value)
      if (entries.size > limit) {
        const leastRecentlyUsed = entries.keys().next().value
        if (leastRecentlyUsed !== undefined) entries.delete(leastRecentlyUsed)
      }
      return value
    },
  }
}

/**
 * Cache key. Each part is JSON-encoded before being joined with NUL so that
 * "nothing saved" (`undefined`, encoded as `null`) can never collide with a
 * saved '' (the root of the clone): they are DIFFERENT inputs for `heatTree`.
 */
function keyOf(parts: readonly (string | null | undefined)[]): string {
  return parts.map((part) => JSON.stringify(part ?? null)).join('\u0000')
}

async function resolveRepo(catalog: Catalog, id: string): Promise<string> {
  const repo = await catalog.resolve(id)
  if (repo === null) throw new ApiError('unknown-repo', `no clone named '${id}' under the root`)
  return repo
}

/** No window is the default one; an unknown one is not silently corrected. */
function windowOf(value: unknown): TimeWindow {
  if (value === undefined) return DEFAULT_WINDOW
  if (typeof value === 'string' && isTimeWindow(value)) return value
  throw new ApiError('invalid-window', `window must be one of ${WINDOWS.join(', ')}`)
}

/**
 * '?path=' travels straight through to `heatTree`, which normalises it. Repeated
 * in the query it arrives as an array, and then it is as good as absent.
 */
function pathOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** '' is legal: it is how the heat is scoped to the root of the clone. */
function mainFolderOf(body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'mainFolder' in body &&
    typeof body.mainFolder === 'string'
  ) {
    return body.mainFolder
  }
  throw new ApiError('invalid-body', 'the body must be { mainFolder: string }')
}
