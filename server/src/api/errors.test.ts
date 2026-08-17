import request from 'supertest'
import { expect, test } from 'vitest'
import { AnalysisError } from '../analysis/index.js'
import { createApp } from '../app.js'
import type { AppDeps } from '../app.js'

/**
 * The two codes that answer 500 have no fixture behind them: a real clone does
 * not fail on demand. So these tests build an `AppDeps` whose analysis port
 * throws exactly what is being mapped and read the envelope back. Nothing here
 * touches a clone or a file: every port is a stub.
 *
 * `internal` is what keeps ANYTHING under '/api' from answering outside that
 * envelope, which is what the UI parses — and without a test for it, a
 * regression that stopped registering `errorHandler` would still be green.
 */

/** Never read: the analysis port fails before anything looks at this path. */
const REPO = '/nowhere/alpha'

/** An app whose analysis port fails the way `fail` says, over stubs for the rest. */
function appOver(fail: () => never) {
  const deps: AppDeps = {
    catalog: { list: () => Promise.resolve([]), resolve: () => Promise.resolve(REPO) },
    settings: { mainFolderOf: () => undefined, setMainFolder: () => Promise.resolve() },
    analysis: { readHeadSha: fail, readLastCommitAt: fail, walkHistory: fail, heatTree: fail },
    now: () => new Date(),
  }
  return createApp(deps)
}

test('an unexpected failure comes back as internal, inside the envelope', async () => {
  const app = appOver(() => {
    throw new Error('the disk went away')
  })

  const response = await request(app).get('/api/repos/alpha/summary')

  expect(response.status).toBe(500)
  // Not an HTML page and not a bare 500: the UI reads `error.code` for every
  // failure there is, including the ones nobody foresaw.
  expect(response.body).toEqual({ error: { code: 'internal', message: 'the disk went away' } })
})

test('a git that fails carries its own code into the envelope', async () => {
  const app = appOver(() => {
    throw new AnalysisError('git-failed', "'git log' exited 128", 128)
  })

  const response = await request(app).get('/api/repos/alpha/summary')

  // The analysis module's codes ARE codes of this API: a git that fails is ours.
  expect(response.status).toBe(500)
  expect(response.body).toEqual({ error: { code: 'git-failed', message: "'git log' exited 128" } })
})

test('a body over the size limit is invalid-body, like a malformed one', async () => {
  const app = appOver(() => {
    throw new Error('the analysis is never reached')
  })

  // `express.json()` refuses this before any handler runs, so the failure that
  // reaches the envelope is body-parser's own — the client's fault, not a 500.
  const response = await request(app)
    .put('/api/repos/alpha/settings')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ mainFolder: 'x'.repeat(200 * 1024) }))

  expect(response.status).toBe(400)
  expect(response.body).toEqual({ error: { code: 'invalid-body', message: expect.any(String) } })
})
