import { afterAll, beforeAll, expect, test } from 'vitest'
import { VENTANAS, walkHistory } from './index.js'
import { commitsSinMerges, crearRepoFixture } from '../testing/repo-fixture.js'
import type { CommitFixture, RepoFixture } from '../testing/repo-fixture.js'

/** Instante de referencia fijo: las fechas del fixture son conocidas y no caducan. */
const AHORA = new Date('2026-08-13T12:00:00.000Z')

/**
 * 9 commits en main + 1 en la rama que se mergea = 10 commits sin merges, todos
 * dentro de los últimos 30 días de AHORA. Reparto por autor: ana 5 (dos de ellos
 * con el email en mayúsculas), bea 3, cris 1, dani 1.
 */
const COMMITS: readonly CommitFixture[] = [
  { fecha: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', ficheros: ['src/a.ts'] },
  { fecha: '2026-07-21T09:00:00+00:00', email: 'Ana@Example.com', ficheros: ['src/b.ts'] },
  { fecha: '2026-07-22T09:00:00+00:00', email: 'bea@example.com', ficheros: ['src/f.ts'] },
  {
    fecha: '2026-07-28T09:00:00+00:00',
    email: 'ana@example.com',
    ficheros: ['src/c.ts', 'package-lock.json'],
  },
  {
    fecha: '2026-08-03T09:00:00+00:00',
    email: 'Ana@Example.com',
    ficheros: ['src/d.ts', 'dist/bundle.js'],
  },
  { fecha: '2026-08-04T09:00:00+00:00', email: 'bea@example.com', ficheros: ['src/g.ts'] },
  { fecha: '2026-08-10T09:00:00+00:00', email: 'ana@example.com', ficheros: ['src/e.ts'] },
  {
    fecha: '2026-08-11T09:00:00+00:00',
    email: 'bea@example.com',
    ficheros: ['src/h.ts', 'web/app.min.js'],
  },
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

test('con un fixture de fechas conocidas los cubos suman el total de commits sin merges', async () => {
  const total = commitsSinMerges(fixture.ruta)
  expect(total).toBe(10)

  const sumas: Record<string, number> = {}
  for (const ventana of VENTANAS) {
    const analisis = await walkHistory(fixture.ruta, ventana, { ahora: AHORA })
    sumas[ventana] = analisis.cubos.reduce((acumulado, cubo) => acumulado + cubo.commits, 0)
    expect(analisis.kpis.commits).toBe(total)
  }

  expect(sumas).toEqual({ '30d': total, '90d': total, '12m': total, all: total })
})

test('dos emails del mismo autor que difieren en mayúsculas cuentan como un autor', async () => {
  const analisis = await walkHistory(fixture.ruta, '30d', { ahora: AHORA })

  // ana@example.com firma 3 commits y Ana@Example.com otros 2: es un solo autor,
  // así que los autores activos son 4 (ana, bea, cris, dani) y no 5.
  expect(analisis.kpis.autoresActivos).toBe(4)
  expect(analisis.concentracion.autores).toBe(2)
})

test('en ventana `all` la tendencia es null y se declara no comparable', async () => {
  const analisis = await walkHistory(fixture.ruta, 'all', { ahora: AHORA })

  expect(analisis.tendencia).toEqual({
    comparable: false,
    porcentaje: null,
    commitsVentanaAnterior: null,
    motivo: 'ventana-completa',
  })
  expect(analisis.cubosVentanaAnterior).toBeNull()
})

test('la concentración es el mínimo nº de autores que suma el 80% o más', async () => {
  const analisis = await walkHistory(fixture.ruta, '12m', { ahora: AHORA })

  // 5 + 3 de 10 commits = exactamente el 80%: dos autores, y con uno no llega.
  expect(analisis.concentracion).toEqual({ autores: 2, porcentaje: 80 })
})

test('el análisis no expone ningún email de autor', async () => {
  const analisis = await walkHistory(fixture.ruta, '12m', { ahora: AHORA })

  expect(JSON.stringify(analisis)).not.toContain('@')
})

test('la tendencia se cuenta contra la ventana anterior de igual longitud', async () => {
  const conPrevias = crearRepoFixture({
    commits: [
      { fecha: '2026-07-01T09:00:00+00:00', email: 'ana@example.com', ficheros: ['viejo-1.txt'] },
      { fecha: '2026-07-02T09:00:00+00:00', email: 'ana@example.com', ficheros: ['viejo-2.txt'] },
      { fecha: '2026-08-01T09:00:00+00:00', email: 'ana@example.com', ficheros: ['nuevo-1.txt'] },
      { fecha: '2026-08-02T09:00:00+00:00', email: 'bea@example.com', ficheros: ['nuevo-2.txt'] },
      { fecha: '2026-08-03T09:00:00+00:00', email: 'bea@example.com', ficheros: ['nuevo-3.txt'] },
    ],
  })

  try {
    const analisis = await walkHistory(conPrevias.ruta, '30d', { ahora: AHORA })

    expect(analisis.tendencia).toEqual({
      comparable: true,
      porcentaje: 50,
      commitsVentanaAnterior: 2,
      motivo: null,
    })
  } finally {
    conPrevias.limpiar()
  }
})

test('un repo sin commits devuelve la ventana a cero y sin HEAD', async () => {
  const vacio = crearRepoFixture()

  try {
    const analisis = await walkHistory(vacio.ruta, '30d', { ahora: AHORA })

    expect(analisis.headSha).toBeNull()
    expect(analisis.cubos).toHaveLength(30)
    expect(analisis.kpis).toEqual({ commits: 0, autoresActivos: 0, ficherosTocados: 0 })
    expect(analisis.concentracion).toEqual({ autores: 0, porcentaje: 0 })
  } finally {
    vacio.limpiar()
  }
})

test('el KPI de ficheros tocados ignora lockfiles, bundles y rutas generadas', async () => {
  const analisis = await walkHistory(fixture.ruta, '12m', { ahora: AHORA })

  // 10 ficheros de src/ tocados; package-lock.json, dist/bundle.js y
  // web/app.min.js no cuentan.
  expect(analisis.kpis.ficherosTocados).toBe(10)
})
