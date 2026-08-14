import { homedir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import * as analysis from './analysis/index.js'
import { errorHandler } from './api/errors.js'
import { createRouter } from './api/routes.js'
import { createCatalog } from './repos.js'
import { createSettingsStore } from './settings.js'
import type { Express } from 'express'
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
  /** Reference instant of every window and of the freshness check. */
  now(): Date
}

export function createDeps(): AppDeps {
  const root = process.env.REPO_PULSE_ROOT ?? join(homedir(), 'git')
  const dataDir = process.env.REPO_PULSE_DATA_DIR ?? join(homedir(), '.repo-pulse')

  return {
    catalog: createCatalog(root, analysis),
    settings: createSettingsStore(join(dataDir, 'settings.json')),
    analysis,
    now: () => new Date(),
  }
}

export function createApp(deps: AppDeps): Express {
  const app = express()

  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api', createRouter(deps))
  app.use(errorHandler)

  return app
}
