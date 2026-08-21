import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import App from './App'
import type { Bucket, Clone, Heat, HeatEntry, Summary, SummaryMeta } from './api/types'

const CLONES: Clone[] = [
  {
    // Id and name differ on purpose: the URLs are built from the id, and what
    // the screen calls the repo is the name.
    id: 'alpha',
    name: 'alpha-clone',
    path: '/git/alpha',
    lastCommitAt: '2026-08-13T09:00:00.000Z',
    fetchedAt: '2026-08-18T09:00:00.000Z',
    stale: false,
  },
]

/**
 * Overrides for the summary payload. `Record<string, unknown>` on top of
 * `Partial<Summary>` is deliberate: a test can make the double answer with
 * fields the UI never declared — author identity, say — and prove that none of
 * them reaches the DOM.
 */
type SummaryOverrides = Partial<Summary> & Record<string, unknown>

/** A summary whose `meta` — and, for the pulse, whose series — the test picks. */
function summaryWith(meta: SummaryMeta, overrides: SummaryOverrides = {}): Summary {
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

/** A bucket of the two series: `commits` for the pulse, `authors` for people. */
function bucket(start: string, commits: number, authors = 1): Bucket {
  return { start, commits, authors }
}

/**
 * The heat tree the double answers with, keyed by the level asked for. The
 * saved main folder is the root of the clone, so no `path` in the query and
 * `''` are the same level.
 */
const HEAT_TREE: Record<string, HeatEntry[]> = {
  '': [
    { name: 'web', kind: 'dir', commits: 18, percent: 60 },
    { name: 'server', kind: 'dir', commits: 12, percent: 40 },
  ],
  web: [{ name: 'src', kind: 'dir', commits: 18, percent: 100 }],
}

function heatFor(url: string): Heat {
  const path = new URL(url, 'http://test.invalid').searchParams.get('path') ?? ''
  const children = HEAT_TREE[path] ?? []
  return {
    window: '12m',
    mainFolder: '',
    fallback: false,
    path,
    commits: children.reduce((total, child) => total + child.commits, 0),
    mainFolderCommits: 30,
    headSha: '0f1e2d3',
    children,
  }
}

/** The heat requests out of `urls`, so a test can look at the last level asked for. */
function heatUrls(urls: readonly string[]): string[] {
  return urls.filter((url) => url.includes('/heat?'))
}

/**
 * Doubles `fetch` with the two endpoints the shell calls, and records every
 * requested URL so a test can look at the last one. `vi.unstubAllGlobals()` in
 * the setup file undoes the stub after each test. `overrides` can also be a
 * function of the requested window, which is how a test gives two windows two
 * different payloads.
 */
function stubApi(
  meta: SummaryMeta,
  overrides: SummaryOverrides | ((window: string) => SummaryOverrides) = {},
): { urls: string[] } {
  const urls: string[] = []
  vi.stubGlobal('fetch', (url: string) => {
    urls.push(url)
    const body =
      url === '/api/repos'
        ? { repos: CLONES }
        : url.includes('/heat?')
          ? heatFor(url)
          : summaryWith(meta, typeof overrides === 'function' ? overrides(windowOf(url)) : overrides)
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as unknown as Response)
  })
  return { urls }
}

/** The `window` query parameter of a summary URL, e.g. `30d`. */
function windowOf(url: string): string {
  return new URL(url, 'http://test.invalid').searchParams.get('window') ?? ''
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

test('the full window declares there is nothing to compare', async () => {
  stubApi(
    { lastCommitAt: null, fetchedAt: null, stale: false },
    {
      window: 'all',
      trend: { comparable: false, percentage: null, previousWindowCommits: null, reason: 'full-window' },
    },
  )

  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'todo' }))

  // The reason travels in the payload: the panel reads `trend.reason`, it does
  // not work out from the window that there is nothing behind it.
  expect(await screen.findByText('ventana completa: no hay comparable')).toBeTruthy()
  expect(screen.getByTestId('trend-headline').textContent).toBe('—')
})

test('changing the window recomputes pulse, trend and KPIs', async () => {
  stubApi({ lastCommitAt: null, fetchedAt: null, stale: false }, (window) =>
    window === '30d'
      ? {
          window: '30d',
          bucket: 'day',
          from: '2026-07-20T00:00:00.000Z',
          buckets: [bucket('2026-08-17T00:00:00.000Z', 1), bucket('2026-08-18T00:00:00.000Z', 3)],
          trend: { comparable: true, percentage: -25, previousWindowCommits: 16, reason: null },
          kpis: { commits: 12, activeAuthors: 2, filesTouched: 9 },
        }
      : {
          buckets: [bucket('2026-07-01T00:00:00.000Z', 2), bucket('2026-08-01T00:00:00.000Z', 4)],
          trend: { comparable: true, percentage: 40, previousWindowCommits: 30, reason: null },
          kpis: { commits: 42, activeAuthors: 5, filesTouched: 31 },
        },
  )

  render(<App />)
  const current = await screen.findByTestId('pulse-current')
  // The node the window change must NOT recreate: the shell re-renders, the
  // page is never reloaded.
  const select = screen.getByRole('combobox', { name: 'Repositorio' })
  expect(current.getAttribute('points')).toBe('0.0,102.5 600.0,6.0')
  expect(screen.getByTestId('trend-headline').textContent).toBe('+40%')
  expect(screen.getByTestId('kpi-commits').textContent).toBe('42')

  fireEvent.click(screen.getByRole('button', { name: '30 días' }))

  // The shell blanks the summary while the new window loads, so the three
  // blocks below are the ones the second payload drew, not leftovers.
  await waitFor(() => {
    expect(screen.getByTestId('trend-headline').textContent).toBe('-25%')
  })
  expect(screen.getByTestId('pulse-current').getAttribute('points')).toBe('0.0,134.7 600.0,6.0')
  expect(screen.getByTestId('kpi-commits').textContent).toBe('12')
  expect(screen.getByRole('combobox', { name: 'Repositorio' })).toBe(select)
})

test('no author identity reaches the DOM', async () => {
  stubApi(
    { lastCommitAt: null, fetchedAt: null, stale: false },
    {
      buckets: [bucket('2026-07-01T00:00:00.000Z', 3, 4), bucket('2026-08-01T00:00:00.000Z', 5, 7)],
      kpis: { commits: 25, activeAuthors: 7, filesTouched: 12 },
      concentration: { authors: 2, percentage: 80 },
      // Identity the API never declares and the server never sends: it is here
      // so the UI has something to leak if it ever renders what it was not
      // asked to render.
      topAuthorName: 'Ada Lovelace',
      topAuthorEmail: 'ada@example.com',
    },
  )

  render(<App />)

  // The concentration phrase proves the people block was painted, so the three
  // absences below are absences and not an empty screen.
  expect(await screen.findByText('2 personas concentran 80% de los commits')).toBeTruthy()
  expect(document.body.textContent).not.toContain('Ada Lovelace')
  expect(document.body.textContent).not.toContain('ada@example.com')
  expect(document.body.textContent).not.toContain('@')
})

test('the people block draws active authors per bucket', async () => {
  stubApi(
    { lastCommitAt: null, fetchedAt: null, stale: false },
    {
      // Commits and authors differ on purpose: a line drawn off `commits`
      // would land on other coordinates than the ones pinned below.
      buckets: [bucket('2026-07-01T00:00:00.000Z', 3, 1), bucket('2026-08-01T00:00:00.000Z', 5, 3)],
      kpis: { commits: 8, activeAuthors: 3, filesTouched: 4 },
    },
  )

  render(<App />)

  // Its own geometry: the shorter box of `PEOPLE_GEOMETRY`, whose baseline is
  // 109 and not the pulse's 199.
  expect((await screen.findByTestId('people-authors')).getAttribute('points')).toBe('0.0,74.7 600.0,6.0')
  expect(screen.getByText('autores activos por mes')).toBeTruthy()
})

test('the concentration bar is as wide as its percentage', async () => {
  stubApi(
    { lastCommitAt: null, fetchedAt: null, stale: false },
    {
      buckets: [bucket('2026-07-01T00:00:00.000Z', 9, 4), bucket('2026-08-01T00:00:00.000Z', 16, 5)],
      kpis: { commits: 25, activeAuthors: 5, filesTouched: 12 },
      concentration: { authors: 3, percentage: 64 },
    },
  )

  render(<App />)

  // The width is the payload's `percentage` and nothing else: not the author
  // count, not a share worked out from the KPIs.
  expect((await screen.findByTestId('concentration-bar')).style.width).toBe('64%')
  expect(screen.getByText('3 personas concentran 64% de los commits')).toBeTruthy()
})

test('the heat block hangs from the right column and reloads on a window change', async () => {
  const { urls } = stubApi(
    { lastCommitAt: null, fetchedAt: null, stale: false },
    { buckets: [bucket('2026-07-01T00:00:00.000Z', 2), bucket('2026-08-01T00:00:00.000Z', 4)] },
  )

  render(<App />)

  // The right column of the grid: the same one the trend panel hangs from, and
  // not the one the pulse lives in.
  const breadcrumb = await screen.findByTestId('heat-breadcrumb')
  const column = screen.getByTestId('trend-headline').closest('section')?.parentElement
  expect(column?.contains(breadcrumb)).toBe(true)
  expect(column?.contains(screen.getByTestId('pulse-current'))).toBe(false)
  // The shell hands the block the name of the selected clone, not just its id:
  // the root of the tree is drawn with that name.
  expect(breadcrumb.textContent).toBe('alpha-clone')
  expect(heatUrls(urls).at(-1)).toBe('/api/repos/alpha/heat?window=12m')

  fireEvent.click(screen.getByRole('button', { name: 'todo' }))

  // The window the header picked is the window the heat is asked for.
  await waitFor(() => {
    expect(heatUrls(urls).at(-1)).toBe('/api/repos/alpha/heat?window=all')
  })
  // Redrawn for the new window: the level the server anchors is back on screen.
  expect(await screen.findByText('web/')).toBeTruthy()
})
