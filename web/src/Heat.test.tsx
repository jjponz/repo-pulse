import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import HeatBlock from './Heat'
import type { Heat, HeatEntry } from './api/types'

/** Every level of the tree below hangs from this saved main folder. */
const MAIN_FOLDER = 'src'

function dir(name: string, commits: number, percent: number): HeatEntry {
  return { name, kind: 'dir', commits, percent }
}

function file(name: string, commits: number, percent: number): HeatEntry {
  return { name, kind: 'file', commits, percent }
}

/**
 * The tree the double answers with, keyed by the `path` asked for. Three levels
 * deep on purpose: the first is where the server anchors, and the third is the
 * one that only holds files.
 */
const TREE: Record<string, HeatEntry[]> = {
  src: [dir('checkout', 180, 60), dir('ui', 60, 20)],
  'src/checkout': [dir('pago', 150, 50)],
  'src/checkout/pago': [file('pago.ts', 90, 30), file('total.ts', 60, 20)],
}

/** One `GET /heat` answer for `path`, with the tree's children of that level. */
function levelOf(path: string, children: readonly HeatEntry[]): Heat {
  return {
    window: '12m',
    mainFolder: MAIN_FOLDER,
    fallback: false,
    path,
    commits: children.reduce((total, child) => total + child.commits, 0),
    mainFolderCommits: 300,
    headSha: '0f1e2d3',
    children: [...children],
  }
}

/**
 * Doubles `fetch` with a server that answers by level and records every URL.
 * No `path` in the query means "no level asked for", and the server anchors it
 * at the saved main folder — which is exactly what the block relies on to draw
 * its first level without knowing where that level is.
 */
function stubHeat(tree: Record<string, readonly HeatEntry[]>): { urls: string[] } {
  const urls: string[] = []
  vi.stubGlobal('fetch', (url: string) => {
    urls.push(url)
    const path = pathOf(url) ?? MAIN_FOLDER
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(levelOf(path, tree[path] ?? [])),
    } as unknown as Response)
  })
  return { urls }
}

function pathOf(url: string): string | null {
  return new URL(url, 'http://test.invalid').searchParams.get('path')
}

/** The names the level draws, in order. The first span of a row is its bar and carries no text. */
function rowNames(): string[] {
  return screen.getAllByTestId('heat-row').map((row) => row.children[1]?.textContent ?? '')
}

function row(name: string): HTMLElement {
  const found = screen.getByText(name).closest('[data-testid="heat-row"]')
  if (found === null) throw new Error(`no heat row named ${name}`)
  return found as HTMLElement
}

function crumbLabels(): string[] {
  return within(screen.getByTestId('heat-breadcrumb'))
    .getAllByRole('button')
    .map((crumb) => crumb.textContent ?? '')
}

function crumb(label: string): HTMLElement {
  return within(screen.getByTestId('heat-breadcrumb')).getByRole('button', { name: label })
}

function upButton(): HTMLElement {
  return screen.getByRole('button', { name: '← subir' })
}

function footer(): string {
  return screen.getByText(/el % es sobre/).textContent ?? ''
}

test('the drill-down goes down to files and the breadcrumb comes back to any level', async () => {
  stubHeat(TREE)

  render(<HeatBlock repoId="alpha" repoName="alpha" window="12m" />)

  // First level: the server anchored it at the main folder, so that is the
  // only crumb and the block never had to know its name in advance.
  await waitFor(() => {
    expect(rowNames()).toEqual(['checkout/', 'ui/'])
  })
  expect(crumbLabels()).toEqual(['src'])
  expect(footer()).toBe(
    '2 hijos tocados · 240 commits aquí · total de la carpeta principal 300 · el % es sobre el total de la carpeta principal.',
  )

  fireEvent.click(row('checkout/'))

  await waitFor(() => {
    expect(rowNames()).toEqual(['pago/'])
  })

  fireEvent.click(row('pago/'))

  await waitFor(() => {
    expect(rowNames()).toEqual(['pago.ts', 'total.ts'])
  })
  // A file does not navigate, so it is not a button: a button that does
  // nothing lies to a screen reader.
  expect(screen.getAllByTestId('heat-row').map((element) => element.tagName)).toEqual(['DIV', 'DIV'])
  // What a file row carries, cell by cell: its bare name, its commits, the
  // percent the server sent, and no chevron because there is nowhere to go.
  expect(screen.getAllByTestId('heat-row').map((element) => element.textContent)).toEqual([
    'pago.ts9030%',
    'total.ts6020%',
  ])
  expect(crumbLabels()).toEqual(['src', 'checkout', 'pago'])
  // The footer describes the level that is drawn, not the one it started at.
  expect(footer()).toBe(
    '2 hijos tocados · 150 commits aquí · total de la carpeta principal 300 · el % es sobre el total de la carpeta principal.',
  )

  // Back to the FIRST level from the THIRD: coming back to the level right
  // above is what `← subir` covers, and jumping over one is what makes the
  // breadcrumb reach *any* level already walked.
  fireEvent.click(crumb('src'))

  await waitFor(() => {
    expect(rowNames()).toEqual(['checkout/', 'ui/'])
  })
  expect(crumbLabels()).toEqual(['src'])
})

test('going up one level asks for the parent', async () => {
  const { urls } = stubHeat(TREE)

  render(<HeatBlock repoId="alpha" repoName="alpha" window="12m" />)

  await waitFor(() => {
    expect(rowNames()).toEqual(['checkout/', 'ui/'])
  })
  // On the first crumb there is nothing above to ask for.
  expect(upButton().hasAttribute('disabled')).toBe(true)

  // Two levels down, so the parent of the current level is not the first crumb
  // and going up cannot land on the right level by accident.
  fireEvent.click(row('checkout/'))
  await waitFor(() => {
    expect(rowNames()).toEqual(['pago/'])
  })
  fireEvent.click(row('pago/'))
  await waitFor(() => {
    expect(rowNames()).toEqual(['pago.ts', 'total.ts'])
  })
  expect(upButton().hasAttribute('disabled')).toBe(false)

  fireEvent.click(upButton())

  // The parent of `src/checkout/pago`, not the main folder the block started
  // at: what is asked for is the crumb right above the current one.
  await waitFor(() => {
    expect(pathOf(urls.at(-1) ?? '')).toBe('src/checkout')
  })
  expect(rowNames()).toEqual(['pago/'])
})

test('a failed load reports its code', async () => {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: { code: 'git-failed', message: 'git log exited 128' } }),
    } as unknown as Response),
  )

  render(<HeatBlock repoId="alpha" repoName="alpha" window="12m" />)

  // The envelope's code reaches the screen; its message does not.
  expect((await screen.findByRole('alert')).textContent).toBe(
    'No se ha podido cargar el calor (git-failed).',
  )
  expect(screen.queryAllByTestId('heat-row')).toEqual([])
  expect(screen.queryByTestId('heat-breadcrumb')).toBeNull()
})

test('a level nobody touched says so instead of drawing rows', async () => {
  stubHeat({ src: [] })

  render(<HeatBlock repoId="alpha" repoName="alpha" window="12m" />)

  // The window is spelled out long, and the level still names itself in the
  // breadcrumb: nothing was touched, but the level is there.
  expect(await screen.findByText('Ninguna carpeta tocada en 12 meses')).toBeTruthy()
  expect(screen.getByText('Sin commits en la ventana no hay reparto que medir.')).toBeTruthy()
  expect(crumbLabels()).toEqual(['src'])
  expect(screen.queryAllByTestId('heat-row')).toEqual([])
  expect(footer()).toBe(
    'El árbol sigue ahí; en esta ventana nadie lo ha tocado. · el % es sobre el total de la carpeta principal.',
  )
})
