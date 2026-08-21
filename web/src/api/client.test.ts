import { expect, test, vi } from 'vitest'
import { ApiError, fetchHeat, fetchRepos, fetchSummary, saveMainFolder } from './client'
import type { Clone } from './types'

/** A minimal stand-in for the DOM `Response` the real `fetch` resolves to. */
function stubResponse(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as unknown as Response
}

test('lists the clones', async () => {
  const repos: Clone[] = [
    { id: 'alpha', name: 'alpha', path: '/git/alpha', lastCommitAt: null, fetchedAt: null, stale: false },
  ]
  const fetchMock = vi.fn().mockResolvedValue(stubResponse({ repos }))
  vi.stubGlobal('fetch', fetchMock)

  const result = await fetchRepos()

  expect(result).toEqual(repos)
  expect(fetchMock).toHaveBeenCalledWith('/api/repos', expect.anything())
})

test('asks the summary for the window it is given', async () => {
  const fetchMock = vi.fn().mockResolvedValue(stubResponse({ window: 'all' }))
  vi.stubGlobal('fetch', fetchMock)

  await fetchSummary('alpha', 'all')

  expect(fetchMock).toHaveBeenCalledWith('/api/repos/alpha/summary?window=all', expect.anything())
})

test('surfaces the code of the error envelope', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(stubResponse({ error: { code: 'invalid-window', message: 'x' } }, false))
  vi.stubGlobal('fetch', fetchMock)

  const error: unknown = await fetchSummary('r', '30d').catch((caught: unknown) => caught)

  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).code).toBe('invalid-window')
})

test('a body that is not the envelope is internal', async () => {
  const fetchMock = vi.fn().mockResolvedValue(stubResponse({ message: 'plain 400' }, false))
  vi.stubGlobal('fetch', fetchMock)

  const error: unknown = await fetchSummary('r', '30d').catch((caught: unknown) => caught)

  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).code).toBe('internal')
})

test('asks the heat for the level it is given', async () => {
  const fetchMock = vi.fn().mockResolvedValue(stubResponse({ window: '90d' }))
  vi.stubGlobal('fetch', fetchMock)

  await fetchHeat('alpha', '90d', 'src/ui')

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/repos/alpha/heat?window=90d&path=src%2Fui',
    expect.anything(),
  )
})

test('the root level travels as an empty path, not as no path', async () => {
  const fetchMock = vi.fn().mockResolvedValue(stubResponse({ window: '90d' }))
  vi.stubGlobal('fetch', fetchMock)

  await fetchHeat('alpha', '90d', '')
  await fetchHeat('alpha', '90d')

  expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
    '/api/repos/alpha/heat?window=90d&path=',
    '/api/repos/alpha/heat?window=90d',
  ])
})

test('saves the main folder with a PUT and a JSON body', async () => {
  const fetchMock = vi.fn().mockResolvedValue(stubResponse({ mainFolder: 'src/ui' }))
  vi.stubGlobal('fetch', fetchMock)

  const result = await saveMainFolder('alpha', 'src/ui')

  expect(result).toEqual({ mainFolder: 'src/ui' })
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/repos/alpha/settings',
    expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mainFolder: 'src/ui' }),
    }),
  )
})

test('a rejected main folder surfaces its code', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(stubResponse({ error: { code: 'invalid-body', message: 'x' } }, false))
  vi.stubGlobal('fetch', fetchMock)

  const error: unknown = await saveMainFolder('alpha', 42 as unknown as string).catch(
    (caught: unknown) => caught,
  )

  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).code).toBe('invalid-body')
})
