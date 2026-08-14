import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Commit } from './tipos.js'

const ejecutar = promisify(execFile)

/** Salida máxima de 'git log' que aceptamos en memoria (repos con decenas de miles de commits). */
const MAX_SALIDA = 64 * 1024 * 1024

const SEPARADOR_REGISTRO = '\u0000'
const SEPARADOR_CAMPO = '\u001f'

/**
 * '%aI' = fecha de autor en ISO 8601 estricto. '%aE' = email de autor CON
 * '.mailmap' aplicado; '%ae' (minúscula) no lo aplica y por eso no se usa.
 */
const FORMATO = '%x00%H%x1f%aI%x1f%aE'

/**
 * '--no-merges': los merges no son trabajo. '--no-renames': un rename es un path
 * nuevo. '--root': sin él, los ficheros del commit raíz no aparecerían.
 */
const ARGS_LOG: readonly string[] = [
  'log',
  'HEAD',
  '--no-merges',
  '--no-renames',
  '--root',
  `--pretty=format:${FORMATO}`,
  '--name-only',
]

export type CodigoErrorAnalisis = 'no-es-repo-git' | 'git-ha-fallado'

export class ErrorAnalisis extends Error {
  readonly codigo: CodigoErrorAnalisis

  constructor(codigo: CodigoErrorAnalisis, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorAnalisis'
    this.codigo = codigo
  }
}

export interface Historial {
  /** sha de HEAD, o null si el repo no tiene ningún commit */
  headSha: string | null
  /** commits sin merges alcanzables desde HEAD, del más reciente al más antiguo */
  commits: Commit[]
}

export async function leerHistorial(repo: string): Promise<Historial> {
  const headSha = await leerHeadSha(repo)
  if (headSha === null) return { headSha: null, commits: [] }
  return { headSha, commits: parsearHistorial(await git(repo, ARGS_LOG)) }
}

/**
 * sha de HEAD sin recorrer el historial: es la tercera pata de la clave de caché
 * (repo, ventana, sha de HEAD) y este módulo es el único que ejecuta git.
 */
export async function leerHeadSha(repo: string): Promise<string | null> {
  asegurarRepoGit(repo)
  try {
    return (await git(repo, ['rev-parse', 'HEAD'])).trim()
  } catch {
    // Un repo git recién inicializado no tiene HEAD todavía: no es un fallo.
    return null
  }
}

export function parsearHistorial(salida: string): Commit[] {
  const commits: Commit[] = []
  for (const registro of salida.split(SEPARADOR_REGISTRO)) {
    if (registro.trim() === '') continue
    const lineas = registro.split('\n')
    const [sha, fechaISO, email] = (lineas[0] ?? '').split(SEPARADOR_CAMPO)
    if (sha === undefined || fechaISO === undefined || email === undefined) continue
    const fecha = Date.parse(fechaISO)
    if (Number.isNaN(fecha)) continue
    commits.push({
      sha,
      fecha,
      autor: email.trim().toLowerCase(),
      ficheros: lineas.slice(1).filter((linea) => linea !== ''),
    })
  }
  return commits
}

function asegurarRepoGit(repo: string): void {
  if (!existsSync(join(repo, '.git'))) {
    throw new ErrorAnalisis('no-es-repo-git', `${repo} no es un repositorio git: no hay .git`)
  }
}

/** Solo lectura: este módulo nunca hace fetch, pull ni escribe en el clon. */
async function git(repo: string, args: readonly string[]): Promise<string> {
  try {
    const { stdout } = await ejecutar('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      maxBuffer: MAX_SALIDA,
    })
    return stdout
  } catch (error) {
    throw new ErrorAnalisis(
      'git-ha-fallado',
      `git ${args.join(' ')} ha fallado en ${repo}: ${String(error)}`,
    )
  }
}