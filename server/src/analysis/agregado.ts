import { esRuido } from './ruido.js'
import { indiceCubo, rejilla } from './ventanas.js'
import type { Rejilla } from './ventanas.js'
import type { Analisis, Commit, Concentracion, Cubo, Tendencia, Ventana } from './tipos.js'

/** % de commits que define la concentración: el mínimo nº de autores que lo suma. */
const UMBRAL_CONCENTRACION = 80

/** Todo lo que se calcula sin volver a preguntar a git. */
export type Agregado = Omit<Analisis, 'headSha'>

export function agregar(ventana: Ventana, commits: readonly Commit[], ahora: number): Agregado {
  const malla = rejilla(
    ventana,
    ahora,
    commits.map((commit) => commit.fecha),
  )
  const porCubo = repartirEnCubos(malla, commits)
  const cubos: Cubo[] = malla.inicios.map((inicio, i) => {
    const delCubo = porCubo[i] ?? []
    return {
      inicio: new Date(inicio).toISOString(),
      commits: delCubo.length,
      autores: new Set(delCubo.map((commit) => commit.autor)).size,
    }
  })

  const enVentana = porCubo.flat()
  const commitsPorAutor = new Map<string, number>()
  const ficheros = new Set<string>()
  for (const commit of enVentana) {
    commitsPorAutor.set(commit.autor, (commitsPorAutor.get(commit.autor) ?? 0) + 1)
    for (const fichero of commit.ficheros) {
      if (!esRuido(fichero)) ficheros.add(fichero)
    }
  }

  const cubosVentanaAnterior = malla.anterior
    ? repartirEnCubos(malla.anterior, commits).map((delCubo) => delCubo.length)
    : null
  const commitsVentanaAnterior = cubosVentanaAnterior
    ? cubosVentanaAnterior.reduce((suma, commits) => suma + commits, 0)
    : null
  const primerInicio = malla.inicios[0]

  return {
    ventana,
    cubo: malla.cubo,
    desde: primerInicio === undefined ? null : new Date(primerInicio).toISOString(),
    hasta: new Date(malla.fin).toISOString(),
    cubos,
    cubosVentanaAnterior,
    tendencia: tendencia(enVentana.length, commitsVentanaAnterior),
    kpis: {
      commits: enVentana.length,
      autoresActivos: commitsPorAutor.size,
      ficherosTocados: ficheros.size,
    },
    concentracion: concentracion([...commitsPorAutor.values()]),
  }
}

export function tendencia(commits: number, commitsVentanaAnterior: number | null): Tendencia {
  if (commitsVentanaAnterior === null) {
    return {
      comparable: false,
      porcentaje: null,
      commitsVentanaAnterior: null,
      motivo: 'ventana-completa',
    }
  }
  if (commitsVentanaAnterior === 0) {
    return {
      comparable: false,
      porcentaje: null,
      commitsVentanaAnterior: 0,
      motivo: 'sin-commits-previos',
    }
  }
  return {
    comparable: true,
    porcentaje: Math.round((commits / commitsVentanaAnterior - 1) * 100),
    commitsVentanaAnterior,
    motivo: null,
  }
}

/**
 * Mínimo nº de autores que suma el 80% o más de los commits. La comparación es
 * entera (`acumulado * 100 >= 80 * total`) para que el caso de exactamente el
 * 80% no dependa de un flotante.
 */
export function concentracion(commitsPorAutor: readonly number[]): Concentracion {
  const total = commitsPorAutor.reduce((suma, commits) => suma + commits, 0)
  if (total === 0) return { autores: 0, porcentaje: 0 }
  const descendente = [...commitsPorAutor].sort((a, b) => b - a)
  let acumulado = 0
  let autores = 0
  for (const commits of descendente) {
    acumulado += commits
    autores += 1
    if (acumulado * 100 >= UMBRAL_CONCENTRACION * total) break
  }
  return { autores, porcentaje: Math.round((acumulado / total) * 100) }
}

function repartirEnCubos(malla: Rejilla, commits: readonly Commit[]): Commit[][] {
  const porCubo: Commit[][] = malla.inicios.map(() => [])
  for (const commit of commits) {
    const indice = indiceCubo(malla, commit.fecha)
    if (indice === null) continue
    porCubo[indice]?.push(commit)
  }
  return porCubo
}
