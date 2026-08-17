import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Per-repo settings in a JSON file of the server's own data directory: the only
 * thing this server writes. Nothing here touches a clone.
 */

/** Schema version of the file; the first write creates it with `version: 1`. */
const VERSION = 1

export interface RepoSettings {
  /** Level the heat is scoped to, from the root of the clone; '' is the root itself. */
  mainFolder: string
}

export interface SettingsStore {
  /** What is saved for `id`, or undefined when nothing is: then the heat auto-detects. */
  get(id: string): RepoSettings | undefined
  /** Saves and persists; it resolves once the file on disk holds the new value. */
  set(id: string, settings: RepoSettings): Promise<void>
}

/**
 * The store reads the file ONCE, when it is built, so a restart of the server
 * picks up what the previous one wrote and no read afterwards touches the disk.
 * A file that is missing, unreadable or not the shape expected starts the store
 * EMPTY: a preference is not data worth refusing to boot over.
 */
export function createSettingsStore(file: string): SettingsStore {
  const byRepo = read(file)

  return {
    get: (id) => byRepo.get(id),
    async set(id, settings) {
      byRepo.set(id, settings)
      await write(file, byRepo)
    },
  }
}

function read(file: string): Map<string, RepoSettings> {
  const byRepo = new Map<string, RepoSettings>()
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    // Not written yet, unreadable, or not JSON at all.
    return byRepo
  }
  if (typeof parsed !== 'object' || parsed === null || !('repos' in parsed)) return byRepo
  const repos = parsed.repos
  if (typeof repos !== 'object' || repos === null) return byRepo
  // Entry by entry: one unrecognisable repo does not discard the rest.
  for (const [id, settings] of Object.entries(repos)) {
    if (isRepoSettings(settings)) byRepo.set(id, { mainFolder: settings.mainFolder })
  }
  return byRepo
}

function isRepoSettings(value: unknown): value is RepoSettings {
  return (
    typeof value === 'object' &&
    value !== null &&
    'mainFolder' in value &&
    typeof value.mainFolder === 'string'
  )
}

/**
 * Temporary file plus `rename` in the same directory: a crash halfway never
 * leaves a truncated settings file behind, because the rename is atomic and the
 * old file stays whole until it lands.
 *
 * The temporary name is unique PER WRITE, not per process: two `set` calls in
 * flight at the same time would otherwise write the same path and could land a
 * mixed or truncated file — which, given that an unparseable file starts the
 * store empty, means silently losing every saved `mainFolder`.
 */
async function write(file: string, byRepo: ReadonlyMap<string, RepoSettings>): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  const content = JSON.stringify({ version: VERSION, repos: Object.fromEntries(byRepo) }, null, 2)
  await writeFile(temporary, `${content}\n`, 'utf8')
  await rename(temporary, file)
}
