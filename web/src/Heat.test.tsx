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

function selector(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: 'Carpeta principal' }) as HTMLSelectElement
}

/** The percent cell of each row, in order: bar, name, commits, percent, chevron. */
function rowPercents(): string[] {
  return screen.getAllByTestId('heat-row').map((row) => row.children[3]?.textContent ?? '')
}

function okResponse(body: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as unknown as Response)
}

/**
 * The same tree seen from three saved main folders. What the main folder moves
 * is the denominator, so the very same level draws other percentages: with
 * `src` saved, `pago` is half of its 300 commits; with `src/checkout` saved, it
 * is all 150 of that folder.
 */
const SCOPES: Record<string, { commits: number; levels: Record<string, HeatEntry[]> }> = {
  '': { commits: 400, levels: { '': [dir('src', 300, 75), dir('docs', 100, 25)] } },
  src: { commits: 300, levels: TREE },
  'src/checkout': {
    commits: 150,
    levels: {
      'src/checkout': [dir('pago', 150, 100)],
      'src/checkout/pago': [file('pago.ts', 90, 60), file('total.ts', 60, 40)],
    },
  },
}

/**
 * A `fetch` double with settings behind it: the `PUT` stores the main folder and
 * every `GET` after it answers from that folder's scope. That is where "it is
 * remembered when the repo is reopened" lives — in the server, so a UI that
 * stores nothing of its own still starts at the saved folder.
 */
function stubServer(): { urls: string[]; bodies: string[] } {
  const urls: string[] = []
  const bodies: string[] = []
  let saved = MAIN_FOLDER
  vi.stubGlobal('fetch', (url: string, options?: { method?: string; body?: string }) => {
    urls.push(url)
    if (options?.method === 'PUT') {
      const body = options.body ?? ''
      bodies.push(body)
      saved = (JSON.parse(body) as { mainFolder: string }).mainFolder
      return okResponse({ mainFolder: saved })
    }
    const scope = SCOPES[saved]
    const path = pathOf(url) ?? saved
    return okResponse({
      ...levelOf(path, scope?.levels[path] ?? []),
      mainFolder: saved,
      mainFolderCommits: scope?.commits ?? 0,
    })
  })
  return { urls, bodies }
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

test('choosing another main folder rescopes the percentages and is remembered', async () => {
  const { urls, bodies } = stubServer()

  const first = render(<HeatBlock repoId="alpha" repoName="alpha" window="12m" />)

  await waitFor(() => {
    expect(rowNames()).toEqual(['checkout/', 'ui/'])
  })
  expect(selector().value).toBe('src')

  // Two levels down before saving, so a level that is NOT re-anchored is a
  // level the assertions below would see drawn.
  fireEvent.click(row('checkout/'))
  await waitFor(() => {
    expect(rowNames()).toEqual(['pago/'])
  })
  fireEvent.click(row('pago/'))
  await waitFor(() => {
    expect(rowNames()).toEqual(['pago.ts', 'total.ts'])
  })
  expect(rowPercents()).toEqual(['30%', '20%'])

  fireEvent.change(selector(), { target: { value: 'src/checkout' } })

  await waitFor(() => {
    expect(rowNames()).toEqual(['pago/'])
  })
  expect(urls.filter((url) => url.includes('/settings'))).toEqual(['/api/repos/alpha/settings'])
  expect(bodies).toEqual(['{"mainFolder":"src/checkout"}'])
  // The server re-anchors the level, so the reload asks for no level at all —
  // and the same tree comes back over the smaller denominator.
  expect(pathOf(urls.at(-1) ?? '')).toBeNull()
  expect(rowPercents()).toEqual(['100%'])
  expect(footer()).toBe(
    '1 hijo tocado · 150 commits aquí · total de la carpeta principal 150 · el % es sobre el total de la carpeta principal.',
  )

  // Reopening the repo: a block mounted from scratch starts at the saved
  // folder because the server remembers it, not because the UI kept it.
  first.unmount()
  render(<HeatBlock repoId="alpha" repoName="alpha" window="12m" />)

  await waitFor(() => {
    expect(rowNames()).toEqual(['pago/'])
  })
  expect(selector().value).toBe('src/checkout')
  expect(rowPercents()).toEqual(['100%'])

  // Saving from a re-anchored level, where the level is already "none asked
  // for": nothing about the level changes and the block still has to reload.
  // The whole repo is the only way out of the folder, because the selector
  // offers what the level shows and nothing above it.
  expect([...selector().options].map((option) => option.value)).toEqual([
    '',
    'src/checkout',
    'src/checkout/pago',
  ])

  fireEvent.change(selector(), { target: { value: '' } })

  await waitFor(() => {
    expect(rowNames()).toEqual(['src/', 'docs/'])
  })
  expect(bodies).toEqual(['{"mainFolder":"src/checkout"}', '{"mainFolder":""}'])
  expect(rowPercents()).toEqual(['75%', '25%'])
  expect(selector().value).toBe('')
})

test('a fallback says the saved folder is gone and which one is used', async () => {
  let fallback = true
  vi.stubGlobal('fetch', (url: string) =>
    okResponse({
      ...levelOf(pathOf(url) ?? '', [dir('src', 240, 80), dir('docs', 60, 20)]),
      mainFolder: '',
      fallback,
    }),
  )

  const gone = render(<HeatBlock repoId="alpha" repoName="alpha" window="12m" />)

  // The saved folder is not in HEAD any more, so the server scoped the heat to
  // the root and the block says both halves of that.
  expect(
    await screen.findByText(
      'La carpeta principal guardada ya no existe en HEAD: el calor se acota a todo el repo.',
    ),
  ).toBeTruthy()
  expect(selector().value).toBe('')
  expect(screen.getByRole('option', { name: 'todo el repo' })).toBeTruthy()

  fallback = false
  gone.unmount()
  render(<HeatBlock repoId="alpha" repoName="alpha" window="12m" />)

  // Nothing warns while the folder being used is the one that was saved.
  await waitFor(() => {
    expect(rowNames()).toEqual(['src/', 'docs/'])
  })
  expect(screen.queryByText(/ya no existe en HEAD/)).toBeNull()
})

test('a rejected save keeps the level and reports its code', async () => {
  const urls: string[] = []
  vi.stubGlobal('fetch', (url: string, options?: { method?: string }) => {
    urls.push(url)
    if (options?.method === 'PUT') {
      return Promise.resolve({
        ok: false,
        json: () =>
          Promise.resolve({ error: { code: 'invalid-body', message: 'mainFolder must be a string' } }),
      } as unknown as Response)
    }
    const path = pathOf(url) ?? MAIN_FOLDER
    return okResponse(levelOf(path, TREE[path] ?? []))
  })

  render(<HeatBlock repoId="alpha" repoName="alpha" window="12m" />)

  await waitFor(() => {
    expect(rowNames()).toEqual(['checkout/', 'ui/'])
  })
  fireEvent.click(row('checkout/'))
  await waitFor(() => {
    expect(rowNames()).toEqual(['pago/'])
  })
  const asked = urls.length

  fireEvent.change(selector(), { target: { value: '' } })

  // The envelope's code reaches the screen; its message does not.
  expect((await screen.findByRole('alert')).textContent).toBe(
    'No se ha podido guardar la carpeta principal (invalid-body).',
  )
  // What is saved rules: the level does not move, no level is asked for again
  // and the selector goes back to the folder the server still has.
  expect(urls.slice(asked)).toEqual(['/api/repos/alpha/settings'])
  expect(rowNames()).toEqual(['pago/'])
  expect(crumbLabels()).toEqual(['src', 'checkout'])
  expect(selector().value).toBe('src')
})
