/**
 * Contratos del módulo de análisis.
 *
 * Ningún tipo público lleva identidad de autor: el email se usa como clave de
 * agregación dentro del módulo y muere aquí. Fuera solo salen conteos,
 * porcentajes y fechas.
 */

export type Ventana = '30d' | '90d' | '12m' | 'all'

export type TamanoCubo = 'dia' | 'semana' | 'mes'

/** Un commit sin merges alcanzable desde HEAD. Interno al módulo. */
export interface Commit {
  sha: string
  /** fecha de autor en epoch ms */
  fecha: number
  /** email de autor en minúsculas y con `.mailmap` aplicado; NO sale del módulo */
  autor: string
  /** rutas tocadas, tal y como las da git (sin filtrar ruido) */
  ficheros: readonly string[]
}

export interface Cubo {
  /** inicio del cubo en ISO 8601 UTC */
  inicio: string
  commits: number
  /** autores distintos con al menos un commit en el cubo */
  autores: number
}

export type MotivoNoComparable = 'ventana-completa' | 'sin-commits-previos'

export interface Tendencia {
  comparable: boolean
  /** variación en % frente a la ventana anterior; null si no es comparable */
  porcentaje: number | null
  commitsVentanaAnterior: number | null
  motivo: MotivoNoComparable | null
}

export interface Kpis {
  commits: number
  autoresActivos: number
  /** ficheros distintos tocados en la ventana, sin contar ruido generado */
  ficherosTocados: number
}

export interface Concentracion {
  /** mínimo nº de autores que suma el 80% o más de los commits de la ventana */
  autores: number
  /** % de commits que acumulan esos autores, redondeado */
  porcentaje: number
}

export interface Analisis {
  ventana: Ventana
  cubo: TamanoCubo
  /** inicio de la ventana en ISO 8601 UTC; null si no hay ningún commit en `all` */
  desde: string | null
  /** fin EXCLUSIVO de la ventana en ISO 8601 UTC */
  hasta: string
  /** sha de HEAD; null si el repo no tiene ningún commit */
  headSha: string | null
  cubos: Cubo[]
  /** commits por cubo de la ventana anterior de igual longitud; null en `all` */
  cubosVentanaAnterior: number[] | null
  tendencia: Tendencia
  kpis: Kpis
  concentracion: Concentracion
}
