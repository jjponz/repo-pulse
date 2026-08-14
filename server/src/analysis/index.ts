import { agregar } from './agregado.js'
import { leerHistorial } from './git.js'
import type { Analisis, Ventana } from './tipos.js'

export interface OpcionesWalkHistory {
  /** instante de referencia de la ventana; por defecto, el momento de la llamada */
  ahora?: Date
}

/**
 * Recorre el historial de HEAD del clon `repo` y devuelve el análisis de la
 * ventana pedida: cubos de commits, serie de autores por cubo, tendencia frente
 * a la ventana anterior, KPIs y concentración de autoría.
 *
 * Es el único punto de entrada del módulo, y el módulo es el único código del
 * repo que ejecuta git. Ningún nombre ni email de autor sale de aquí.
 */
export async function walkHistory(
  repo: string,
  ventana: Ventana,
  opciones: OpcionesWalkHistory = {},
): Promise<Analisis> {
  const ahora = (opciones.ahora ?? new Date()).getTime()
  const { headSha, commits } = await leerHistorial(repo)
  return { ...agregar(ventana, commits, ahora), headSha }
}

export { ErrorAnalisis, leerHeadSha } from './git.js'
// `Historial` NO se exporta a propósito: lleva `Commit[]`, y un `Commit` lleva
// el email del autor. Ese tipo muere en el módulo, como el dato.
export type { CodigoErrorAnalisis } from './git.js'
export { VENTANAS, VENTANA_POR_DEFECTO, esVentana } from './ventanas.js'
export type {
  Analisis,
  Concentracion,
  Cubo,
  Kpis,
  MotivoNoComparable,
  TamanoCubo,
  Tendencia,
  Ventana,
} from './tipos.js'
