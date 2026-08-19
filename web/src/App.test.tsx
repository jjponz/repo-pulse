import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import App from './App'
import type { Clone, Summary, SummaryMeta } from './api/types'

const CLONES: Clone[] = [
  {
    id: 'alpha',
    name: 'alpha',
    path: '/git/alpha',
    lastCommitAt: '2026-08-13T09:00:00.000Z',
    fetchedAt: '2026-08-18T09:00:00.000Z',
    stale: false,
  },
]

/** The `meta` block is the only part of the summary this shell reads today. */
function summaryWith(meta: SummaryMeta): Summary {
  return {
    window: '12m',
    bucket: 'month',
    from: '2025-09-01T00:00:00.000Z',
    to: '2026-08-19T00:00:00.000Z',
    headSha: '0f1e2d3',
    buckets: [],
    previousWindowBuckets: null,
    trend: { comparable: false, percentage: null, previousWindowCommits: null, reason: 'full-window' },
    kpis: { commits: 0, activeAuthors: 0, filesTouched: 0 },
    concentration: { authors: 0, percentage: 0 },
    meta,
  }
}

/**
 * Doubles `fetch` with the two endpoints the shell calls, and records every
 * requested URL so a test can look at the last one. `vi.unstubAllGlobals()` in
 * the setup file undoes the stub after each test.
 */
function stubApi(meta: SummaryMeta): { urls: string[] } {
  const urls: string[] = []
  vi.stubGlobal('fetch', (url: string) => {
    urls.push(url)
    const body = url === '/api/repos' ? { repos: CLONES } : summaryWith(meta)
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as unknown as Response)
  })
  return { urls }
}

test('the header shows the last commit and the fetch date', async () => {
  stubApi({ lastCommitAt: '2026-08-13T09:00:00.000Z', fetchedAt: '2026-08-18T09:00:00.000Z', stale: false })

  render(<App />)

  expect((await screen.findByText(/último commit/)).textContent).toContain('13 ago 2026')
  expect(await screen.findByText(/traída/)).toBeTruthy()
})

test('without dates the header shows neither', async () => {
  stubApi({ lastCommitAt: null, fetchedAt: null, stale: false })

  render(<App />)

  // The path of the selected clone and the gone placeholder prove both loads
  // landed, so the two absences below are absences and not an empty screen.
  expect(await screen.findByText('/git/alpha')).toBeTruthy()
  await waitFor(() => {
    expect(screen.queryByText('Cargando…')).toBeNull()
  })
  expect(screen.queryByText(/último commit/)).toBeNull()
  expect(screen.queryByText(/traída/)).toBeNull()
})

test('changing the window asks the API for that window', async () => {
  const { urls } = stubApi({ lastCommitAt: null, fetchedAt: null, stale: false })

  render(<App />)
  await waitFor(() => {
    expect(urls.at(-1)).toContain('window=12m')
  })

  fireEvent.click(screen.getByRole('button', { name: 'todo' }))

  await waitFor(() => {
    expect(urls.at(-1)).toContain('window=all')
  })
})
