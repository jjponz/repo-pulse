import type { TamanoCubo, Ventana } from './tipos.js'

const MS_DIA = 86_400_000

interface VentanaFija {
  cubo: TamanoCubo
  cubos: number
  dias: number
}

/**
 * La longitud de una ventana es nº de cubos × tamaño de cubo (30, 91 y 364
 * días), de modo que la ventana anterior es exactamente igual de larga.
 */
const VENTANAS_FIJAS: Record<'30d' | '90d' | '12m', VentanaFija> = {
  '30d': { cubo: 'dia', cubos: 30, dias: 1 },
  '90d': { cubo: 'semana', cubos: 13, dias: 7 },
  '12m': { cubo: 'semana', cubos: 52, dias: 7 },
}

export const VENTANAS: readonly Ventana[] = ['30d', '90d', '12m', 'all']

export const VENTANA_POR_DEFECTO: Ventana = '12m'

export function esVentana(valor: string): valor is Ventana {
  return (VENTANAS as readonly string[]).includes(valor)
}

/** Rejilla de cubos: el cubo `i` cubre [inicios[i], inicios[i + 1]) y el último acaba en `fin`. */
export interface Rejilla {
  cubo: TamanoCubo
  /** inicio de cada cubo en epoch ms, ascendente */
  inicios: number[]
  /** fin EXCLUSIVO de la ventana en epoch ms */
  fin: number
  /** ventana anterior de igual longitud; null cuando no hay comparable (`all`) */
  anterior: Rejilla | null
}

export function rejilla(ventana: Ventana, ahora: number, fechas: readonly number[]): Rejilla {
  if (ventana === 'all') return rejillaMensual(ahora, fechas)
  const definicion = VENTANAS_FIJAS[ventana]
  const actual = rejillaFija(definicion, ahora)
  const inicioActual = actual.inicios[0] ?? ahora
  return { ...actual, anterior: rejillaFija(definicion, inicioActual) }
}

/** Índice del cubo al que cae `fecha`, o null si queda fuera de la ventana. */
export function indiceCubo(malla: Rejilla, fecha: number): number | null {
  if (fecha >= malla.fin) return null
  for (let i = malla.inicios.length - 1; i >= 0; i--) {
    const inicio = malla.inicios[i]
    if (inicio !== undefined && fecha >= inicio) return i
  }
  return null
}

function rejillaFija(definicion: VentanaFija, fin: number): Rejilla {
  const largo = definicion.dias * MS_DIA
  const inicios: number[] = []
  for (let i = definicion.cubos; i > 0; i--) inicios.push(fin - i * largo)
  return { cubo: definicion.cubo, inicios, fin, anterior: null }
}

/**
 * `all` va del mes del primer commit al mes del último commit o de `ahora` (el
 * más tardío), inclusive: así no se pierde ni un commit. No tiene comparable.
 */
function rejillaMensual(ahora: number, fechas: readonly number[]): Rejilla {
  const primera = fechas[0]
  if (primera === undefined) {
    return { cubo: 'mes', inicios: [], fin: sumarMeses(inicioDeMes(ahora), 1), anterior: null }
  }
  let masAntigua = primera
  let masReciente = primera
  for (const fecha of fechas) {
    if (fecha < masAntigua) masAntigua = fecha
    if (fecha > masReciente) masReciente = fecha
  }
  const primerMes = inicioDeMes(masAntigua)
  const ultimoMes = inicioDeMes(Math.max(masReciente, ahora))
  const inicios: number[] = []
  for (let i = 0; i <= mesesEntre(primerMes, ultimoMes); i++) inicios.push(sumarMeses(primerMes, i))
  return { cubo: 'mes', inicios, fin: sumarMeses(ultimoMes, 1), anterior: null }
}

function inicioDeMes(ms: number): number {
  const fecha = new Date(ms)
  return Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1)
}

function sumarMeses(ms: number, meses: number): number {
  const fecha = new Date(ms)
  return Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + meses, 1)
}

function mesesEntre(desde: number, hasta: number): number {
  const a = new Date(desde)
  const b = new Date(hasta)
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
}
