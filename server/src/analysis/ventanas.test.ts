import { expect, test } from 'vitest'
import { VENTANAS, VENTANA_POR_DEFECTO, esVentana, indiceCubo, rejilla } from './ventanas.js'

const AHORA = Date.parse('2026-08-13T12:00:00.000Z')
const MS_DIA = 86_400_000

test('las ventanas son las cuatro del spec y la de por defecto es 12m', () => {
  expect(VENTANAS).toEqual(['30d', '90d', '12m', 'all'])
  expect(VENTANA_POR_DEFECTO).toBe('12m')
})

test('esVentana solo acepta las cuatro ventanas', () => {
  expect(esVentana('30d')).toBe(true)
  expect(esVentana('all')).toBe(true)
  expect(esVentana('7d')).toBe(false)
})

test('30d son 30 cubos de un día que acaban en ahora', () => {
  const malla = rejilla('30d', AHORA, [])

  expect(malla.cubo).toBe('dia')
  expect(malla.inicios).toHaveLength(30)
  expect(malla.fin).toBe(AHORA)
  expect(malla.inicios[0]).toBe(AHORA - 30 * MS_DIA)
  expect(malla.inicios[29]).toBe(AHORA - MS_DIA)
})

test('90d son 13 cubos semanales y 12m son 52', () => {
  expect(rejilla('90d', AHORA, []).cubo).toBe('semana')
  expect(rejilla('90d', AHORA, []).inicios).toHaveLength(13)
  expect(rejilla('12m', AHORA, []).cubo).toBe('semana')
  expect(rejilla('12m', AHORA, []).inicios).toHaveLength(52)
})

test('la ventana anterior mide lo mismo y acaba donde empieza la actual', () => {
  const malla = rejilla('12m', AHORA, [])
  const anterior = malla.anterior

  expect(anterior?.inicios).toHaveLength(52)
  expect(anterior?.fin).toBe(malla.inicios[0])
  expect(anterior?.anterior).toBeNull()
})

test('all va del mes del primer commit al mes de ahora y no tiene comparable', () => {
  const malla = rejilla('all', AHORA, [
    Date.parse('2026-07-01T00:00:00.000Z'),
    Date.parse('2026-06-15T00:00:00.000Z'),
  ])

  expect(malla.cubo).toBe('mes')
  expect(malla.anterior).toBeNull()
  expect(malla.inicios.map((ms) => new Date(ms).toISOString())).toEqual([
    '2026-06-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z',
    '2026-08-01T00:00:00.000Z',
  ])
  expect(new Date(malla.fin).toISOString()).toBe('2026-09-01T00:00:00.000Z')
})

test('all sin commits no tiene ningún cubo', () => {
  expect(rejilla('all', AHORA, []).inicios).toEqual([])
})

test('el cubo incluye su inicio y la ventana excluye su fin', () => {
  const malla = rejilla('30d', AHORA, [])

  expect(indiceCubo(malla, AHORA)).toBeNull()
  expect(indiceCubo(malla, AHORA - 1)).toBe(29)
  expect(indiceCubo(malla, AHORA - 30 * MS_DIA)).toBe(0)
  expect(indiceCubo(malla, AHORA - 30 * MS_DIA - 1)).toBeNull()
})
