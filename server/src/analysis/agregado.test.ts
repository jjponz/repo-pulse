import { expect, test } from 'vitest'
import { agregar, concentracion, tendencia } from './agregado.js'
import type { Commit } from './tipos.js'

const AHORA = Date.parse('2026-08-13T12:00:00.000Z')

function commit(fecha: string, autor: string, ficheros: readonly string[] = ['src/a.ts']): Commit {
  return { sha: fecha, fecha: Date.parse(fecha), autor, ficheros }
}

test('la concentración es el mínimo nº de autores que suma el 80% o más', () => {
  expect(concentracion([5, 3, 1, 1])).toEqual({ autores: 2, porcentaje: 80 })
  expect(concentracion([1, 1, 1, 1, 1])).toEqual({ autores: 4, porcentaje: 80 })
  expect(concentracion([8, 2])).toEqual({ autores: 1, porcentaje: 80 })
  expect(concentracion([10])).toEqual({ autores: 1, porcentaje: 100 })
})

test('sin commits la concentración no tiene autores', () => {
  expect(concentracion([])).toEqual({ autores: 0, porcentaje: 0 })
})

test('la tendencia compara con la ventana anterior de igual longitud', () => {
  expect(tendencia(3, 2)).toEqual({
    comparable: true,
    porcentaje: 50,
    commitsVentanaAnterior: 2,
    motivo: null,
  })
  expect(tendencia(1, 2)).toEqual({
    comparable: true,
    porcentaje: -50,
    commitsVentanaAnterior: 2,
    motivo: null,
  })
})

test('sin commits en la ventana anterior la tendencia no es comparable', () => {
  expect(tendencia(5, 0)).toEqual({
    comparable: false,
    porcentaje: null,
    commitsVentanaAnterior: 0,
    motivo: 'sin-commits-previos',
  })
})

test('sin ventana anterior la tendencia no es comparable', () => {
  expect(tendencia(5, null)).toEqual({
    comparable: false,
    porcentaje: null,
    commitsVentanaAnterior: null,
    motivo: 'ventana-completa',
  })
})

test('cada cubo lleva sus commits y sus autores distintos, y lo de fuera no cuenta', () => {
  const commits = [
    commit('2026-08-13T09:00:00.000Z', 'ana@example.com'),
    commit('2026-08-13T10:00:00.000Z', 'bea@example.com'),
    commit('2026-08-12T09:00:00.000Z', 'ana@example.com'),
    commit('2026-06-01T09:00:00.000Z', 'cris@example.com'),
  ]

  const agregado = agregar('30d', commits, AHORA)

  expect(agregado.cubos).toHaveLength(30)
  expect(agregado.cubos.at(-1)).toEqual({
    inicio: '2026-08-12T12:00:00.000Z',
    commits: 2,
    autores: 2,
  })
  expect(agregado.kpis).toEqual({ commits: 3, autoresActivos: 2, ficherosTocados: 1 })
})

test('el KPI de ficheros tocados no cuenta ruido generado', () => {
  const commits = [
    commit('2026-08-13T09:00:00.000Z', 'ana@example.com', [
      'src/a.ts',
      'package-lock.json',
      'dist/bundle.js',
      'web/app.min.js',
    ]),
  ]

  expect(agregar('30d', commits, AHORA).kpis.ficherosTocados).toBe(1)
})

test('en all los cubos son meses y no hay serie de la ventana anterior', () => {
  const agregado = agregar('all', [commit('2026-08-01T09:00:00.000Z', 'ana@example.com')], AHORA)

  expect(agregado.cubo).toBe('mes')
  expect(agregado.cubosVentanaAnterior).toBeNull()
  expect(agregado.desde).toBe('2026-08-01T00:00:00.000Z')
  expect(agregado.hasta).toBe('2026-09-01T00:00:00.000Z')
})
