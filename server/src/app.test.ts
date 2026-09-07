import { expect, test } from 'vitest'
import request from 'supertest'
import * as analysis from './analysis/index.js'
import { createApp } from './app.js'
import { CoverageOrder } from './coverage/coverage-order.js'
import { CoverageRanking } from './coverage/coverage-ranking.js'
import type { AppDeps } from './app.js'

/** Health touches no dependency: the emptiest deps that typecheck are enough. */
const deps: AppDeps = {
  catalog: { list: () => Promise.resolve([]), resolve: () => Promise.resolve(null) },
  settings: { mainFolderOf: () => undefined, setMainFolder: () => Promise.resolve() },
  analysis,
  coverage: new CoverageRanking({
    catalog: { list: () => Promise.resolve([]), resolve: () => Promise.resolve(null) },
    artifacts: { readingOf: () => Promise.reject(new Error('not used')) },
    order: new CoverageOrder(),
  }),
  now: () => new Date(),
}

test('GET /api/health responds 200 with { status: "ok" }', async () => {
  const response = await request(createApp(deps)).get('/api/health')

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ status: 'ok' })
})
