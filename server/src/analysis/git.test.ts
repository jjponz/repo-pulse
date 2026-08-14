import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { ErrorAnalisis, leerHeadSha, leerHistorial, parsearHistorial } from './git.js'
import { commitsSinMerges, crearRepoFixture } from '../testing/repo-fixture.js'
import type { CommitFixture, RepoFixture } from '../testing/repo-fixture.js'

const COMMITS: readonly CommitFixture[] = [
  { fecha: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', ficheros: ['src/a.ts'] },
  { fecha: '2026-07-21T09:00:00+00:00', email: 'Ana@Example.com', ficheros: ['src/b.ts'] },
  { fecha: '2026-07-22T09:00:00+00:00', email: 'bea@example.com', ficheros: ['src/f.ts'] },
  { fecha: '2026-08-12T09:00:00+00:00', email: 'cris@example.com', ficheros: ['src/i.ts'] },
]

const MERGE: CommitFixture = {
  fecha: '2026-08-12T10:00:00+00:00',
  email: 'dani@example.com',
  ficheros: ['src/j.ts'],
}

let fixture: RepoFixture

beforeAll(() => {
  fixture = crearRepoFixture({ commits: COMMITS, merge: MERGE })
})

afterAll(() => {
  fixture.limpiar()
})

test('leerHistorial devuelve los commits sin merges de HEAD con el email en minúsculas', async () => {
  const { headSha, commits } = await leerHistorial(fixture.ruta)

  expect(headSha).toMatch(/^[0-9a-f]{40}$/)
  expect(commits).toHaveLength(commitsSinMerges(fixture.ruta))
  expect(commits).toHaveLength(5)
  expect(new Set(commits.map((commit) => commit.autor))).toEqual(
    new Set(['ana@example.com', 'bea@example.com', 'cris@example.com', 'dani@example.com']),
  )
})

test('leerHistorial incluye los ficheros del commit raíz', async () => {
  const { commits } = await leerHistorial(fixture.ruta)

  expect(commits.at(-1)?.ficheros).toEqual(['src/a.ts'])
})

test('leerHistorial aplica .mailmap', async () => {
  const conMailmap = crearRepoFixture({
    commits: COMMITS,
    mailmap: 'Ana <ana@example.com> <bea@example.com>\n',
  })

  try {
    const { commits } = await leerHistorial(conMailmap.ruta)

    expect(new Set(commits.map((commit) => commit.autor))).toEqual(
      new Set(['ana@example.com', 'cris@example.com']),
    )
  } finally {
    conMailmap.limpiar()
  }
})

test('un repo git sin commits no tiene HEAD ni historial', async () => {
  const vacio = crearRepoFixture()

  try {
    expect(await leerHeadSha(vacio.ruta)).toBeNull()
    expect(await leerHistorial(vacio.ruta)).toEqual({ headSha: null, commits: [] })
  } finally {
    vacio.limpiar()
  }
})

test('una carpeta que no es repo git falla con el código no-es-repo-git', async () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'repo-pulse-sin-git-'))

  try {
    await expect(leerHistorial(carpeta)).rejects.toThrow(ErrorAnalisis)
    await expect(leerHistorial(carpeta)).rejects.toMatchObject({ codigo: 'no-es-repo-git' })
  } finally {
    rmSync(carpeta, { recursive: true, force: true })
  }
})

test('parsearHistorial lee el formato de git log con separadores NUL y US', () => {
  const salida =
    '\u0000abc\u001f2026-08-01T10:00:00Z\u001fAna@Example.com\nsrc/a.ts\n\n' +
    '\u0000def\u001f2026-07-31T10:00:00Z\u001fbea@example.com\n'

  expect(parsearHistorial(salida)).toEqual([
    {
      sha: 'abc',
      fecha: Date.parse('2026-08-01T10:00:00Z'),
      autor: 'ana@example.com',
      ficheros: ['src/a.ts'],
    },
    {
      sha: 'def',
      fecha: Date.parse('2026-07-31T10:00:00Z'),
      autor: 'bea@example.com',
      ficheros: [],
    },
  ])
})