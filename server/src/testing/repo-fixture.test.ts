import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { commitsSinMerges, crearRepoFixture } from './repo-fixture.js'
import type { RepoFixture } from './repo-fixture.js'

let fixture: RepoFixture | null = null

afterEach(() => {
  fixture?.limpiar()
  fixture = null
})

test('crearRepoFixture crea un repo git con los commits pedidos y el merge no cuenta', () => {
  fixture = crearRepoFixture({
    commits: [
      { fecha: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', ficheros: ['src/a.ts'] },
      { fecha: '2026-07-21T09:00:00+00:00', email: 'bea@example.com', ficheros: ['src/b.ts'] },
    ],
    merge: { fecha: '2026-07-22T09:00:00+00:00', email: 'cris@example.com', ficheros: ['src/c.ts'] },
  })

  expect(existsSync(join(fixture.ruta, '.git'))).toBe(true)
  expect(commitsSinMerges(fixture.ruta)).toBe(3)
})

test('crearRepoFixture fija la fecha de autor y de commit a la pedida en cada CommitFixture', () => {
  const commits = [
    { fecha: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', ficheros: ['src/a.ts'] },
    { fecha: '2026-07-21T15:30:00+02:00', email: 'bea@example.com', ficheros: ['src/b.ts'] },
  ]
  fixture = crearRepoFixture({ commits })

  // git no exporta un runner propio: leemos las fechas con git directamente.
  const salida = execFileSync('git', ['-C', fixture.ruta, 'log', '--pretty=format:%aI%x09%cI'], {
    encoding: 'utf8',
  })
  const lineas = salida.trim().split('\n')
  expect(lineas).toHaveLength(commits.length)

  // %aI normaliza el offset (p.ej. '+00:00' vuelve como 'Z'): comparamos
  // instantes, no strings. El orden de `git log` no importa: comparamos
  // los conjuntos de instantes ordenados.
  const instantesEsperados = commits.map((commit) => Date.parse(commit.fecha)).sort()
  const instantesAutor = lineas.map((linea) => Date.parse(linea.split('\t')[0] ?? '')).sort()
  const instantesCommitter = lineas.map((linea) => Date.parse(linea.split('\t')[1] ?? '')).sort()

  expect(instantesAutor).toEqual(instantesEsperados)
  expect(instantesCommitter).toEqual(instantesEsperados)
})

test('crearRepoFixture sin commits deja un repo git vacío', () => {
  fixture = crearRepoFixture()

  expect(existsSync(join(fixture.ruta, '.git'))).toBe(true)
  expect(existsSync(join(fixture.ruta, 'src'))).toBe(false)
})

test('limpiar borra el directorio del fixture', () => {
  const creado = crearRepoFixture({
    commits: [{ fecha: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', ficheros: ['a.txt'] }],
  })
  const ruta = creado.ruta

  creado.limpiar()

  expect(existsSync(ruta)).toBe(false)
})
