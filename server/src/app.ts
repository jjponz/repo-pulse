import { homedir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import * as analysis from './analysis/index.js'
import { ApiError, errorHandler } from './api/errors.js'
import { createCache, createRouter } from './api/routes.js'
import { ArtifactFiles } from './coverage/artifact-files.js'
import { CoverageOrder } from './coverage/coverage-order.js'
import { CoverageRanking } from './coverage/coverage-ranking.js'
import { createCatalog } from './repos.js'
import { createSettingsStore } from './settings.js'
import type { Express } from 'express'
import type { CoverageReading } from './coverage/coverage-reading.js'
import type { Catalog } from './repos.js'
import type { SettingsStore } from './settings.js'

/**
 * Composition root: the only place that reads the environment and the only one
 * that knows which real implementation goes behind each port. The tests build
 * their own `AppDeps` over fixtures in `tmp`.
 */

/** The slice of the analysis barrel the API uses. */
export type AnalysisPort = Pick<
  typeof analysis,
  'readHeadSha' | 'readLastCommitAt' | 'walkHistory' | 'heatTree'
>

export interface AppDeps {
  catalog: Catalog
  settings: SettingsStore
  analysis: AnalysisPort
  coverage: CoverageRanking
  /** Reference instant of every window and of the freshness check. */
  now(): Date
}

/** Entries kept per cache: the same bound the other two caches of the API use. */
const COVERAGE_CACHE_LIMIT = 64

export function createDeps(): AppDeps {
  const root = process.env.REPO_PULSE_ROOT ?? join(homedir(), 'git')
  const dataDir = process.env.REPO_PULSE_DATA_DIR ?? join(homedir(), '.repo-pulse')
  // One clock behind everything the API dates: the staleness of the list, the
  // `meta` of a summary and the boundaries of every window.
  const now = () => new Date()
  const catalog = createCatalog(root, analysis, now)

  return {
    catalog,
    settings: createSettingsStore(join(dataDir, 'settings.json')),
    analysis,
    coverage: new CoverageRanking({
      catalog,
      artifacts: new ArtifactFiles(createCache<CoverageReading>(COVERAGE_CACHE_LIMIT)),
      order: new CoverageOrder(),
    }),
    now,
  }
}

export function createApp(deps: AppDeps): Express {
  const app = express()

  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api', createRouter(deps))
  // Nothing under '/api' may answer outside the typed envelope: without this,
  // a mistyped URL would fall through to Express's default HTML 404 and a UI
  // reading `error.code` would get a page of markup instead.
  app.use('/api', (request, _response, next) => {
    next(new ApiError('not-found', `no endpoint at ${request.method} ${request.originalUrl}`))
  })
  app.use(errorHandler)

  return app
}
