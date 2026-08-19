import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import App from './App'
import type { Bucket, Clone, Summary, SummaryMeta } from './api/types'

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

/** A summary whose `meta` — and, for the pulse, whose series — the test picks. */
function summaryWith(meta: SummaryMeta, overrides: Partial<Summary> = {}): Summary {
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
    ...overrides,
  }
}

/** A bucket the pulse can draw: only its `commits` count reaches the chart. */
function bucket(start: string, commits: number): Bucket {
  return { start, commits, authors: 1 }
}

/**
 * Doubles `fetch` with the two endpoints the shell calls, and records every
 * requested URL so a test can look at the last one. `vi.unstubAllGlobals()` in
 * the setup file undoes the stub after each test.
 */
function stubApi(meta: SummaryMeta, overrides: Partial<Summary> = {}): { urls: string[] } {
  const urls: string[] = []
  vi.stubGlobal('fetch', (url: string) => {
    urls.push(url)
    const body = url === '/api/repos' ? { repos: CLONES } : summaryWith(meta, overrides)
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

test('the pulse draws the previous window behind the current one', async () => {
  stubApi(
    { lastCommitAt: null, fetchedAt: null, stale: false },
    {
      buckets: [bucket('2026-07-01T00:00:00.000Z', 2), bucket('2026-08-01T00:00:00.000Z', 4)],
      previousWindowBuckets: [8, 1],
    },
  )

  render(<App />)

  const previous = await screen.findByTestId('pulse-previous')
  const current = screen.getByTestId('pulse-current')
  // Painted first, so the grey series stays behind the current one.
  expect(previous.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // One scale for both: the previous peak of 8 is the ceiling, and the current
  // peak of 4 lands halfway up instead of on the headroom.
  expect(previous.getAttribute('points')).toBe('0.0,6.0 600.0,174.9')
  expect(current.getAttribute('points')).toBe('0.0,150.8 600.0,102.5')
  expect(screen.getByText('commits por mes · gris = los 12 meses anteriores')).toBeTruthy()
})

test('on the full window there is no overlay', async () => {
  stubApi(
    { lastCommitAt: null, fetchedAt: null, stale: false },
    {
      window: 'all',
      buckets: [bucket('2026-07-01T00:00:00.000Z', 2), bucket('2026-08-01T00:00:00.000Z', 4)],
      previousWindowBuckets: null,
    },
  )

  render(<App />)

  // The current series proves the chart is drawn, so the absence below is an
  // absence and not an unrendered block.
  expect(await screen.findByTestId('pulse-current')).toBeTruthy()
  expect(screen.queryByTestId('pulse-previous')).toBeNull()
  expect(screen.getByText('commits por mes')).toBeTruthy()
})
