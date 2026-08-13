import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Repos git de mentira en `tmp`, con fechas de autor y de commit fijadas. Los
 * tests del análisis NUNCA se ejecutan contra clones reales de la máquina.
 */

/** Aísla la config global y de sistema: ni hooks, ni plantillas, ni firma gpg del dev. */
const ENTORNO_AISLADO: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
}

export interface CommitFixture {
  /** fecha de autor y de commit, ISO 8601 con offset explícito */
  fecha: string
  /** email de autor tal cual, para poder probar mayúsculas y `.mailmap` */
  email: string
  /** rutas a crear en ese commit; al menos una, y con contenido distinto al anterior */
  ficheros: readonly string[]
  mensaje?: string
}

export interface EspecificacionFixture {
  commits?: readonly CommitFixture[]
  /**
   * Si viene, se crea una rama con ESE commit y se mergea a main con `--no-ff`:
   * el commit de la rama cuenta, el commit de merge NO debe contarse.
   */
  merge?: CommitFixture
  /** contenido literal de `.mailmap`; se escribe al final y NO se commitea */
  mailmap?: string
}

export interface RepoFixture {
  ruta: string
  limpiar(): void
}

export function crearRepoFixture(especificacion: EspecificacionFixture = {}): RepoFixture {
  const ruta = mkdtempSync(join(tmpdir(), 'repo-pulse-fixture-'))
  git(ruta, ['init', '-q', '-b', 'main', '.'])
  git(ruta, ['config', 'user.name', 'Fixture'])
  git(ruta, ['config', 'user.email', 'fixture@example.com'])
  git(ruta, ['config', 'commit.gpgsign', 'false'])

  for (const commit of especificacion.commits ?? []) escribirCommit(ruta, commit)

  const merge = especificacion.merge
  if (merge !== undefined) {
    git(ruta, ['checkout', '-q', '-b', 'rama-fixture'])
    escribirCommit(ruta, merge)
    git(ruta, ['checkout', '-q', 'main'])
    git(ruta, ['merge', '--no-ff', '-q', 'rama-fixture', '-m', 'merge de fixture'], entornoDe(merge))
  }

  if (especificacion.mailmap !== undefined) {
    writeFileSync(join(ruta, '.mailmap'), especificacion.mailmap)
  }

  return {
    ruta,
    limpiar: () => {
      rmSync(ruta, { recursive: true, force: true })
    },
  }
}

/** Commits sin merges alcanzables desde HEAD según git: el número con el que comparan los tests. */
export function commitsSinMerges(ruta: string): number {
  return Number(git(ruta, ['rev-list', '--no-merges', '--count', 'HEAD']).trim())
}

function escribirCommit(ruta: string, commit: CommitFixture): void {
  for (const fichero of commit.ficheros) {
    const destino = join(ruta, fichero)
    mkdirSync(dirname(destino), { recursive: true })
    writeFileSync(destino, `${commit.fecha} ${fichero}\n`)
  }
  git(ruta, ['add', '-A'])
  git(ruta, ['commit', '-q', '-m', commit.mensaje ?? `commit ${commit.fecha}`], entornoDe(commit))
}

function entornoDe(commit: CommitFixture): NodeJS.ProcessEnv {
  return {
    GIT_AUTHOR_DATE: commit.fecha,
    GIT_COMMITTER_DATE: commit.fecha,
    GIT_AUTHOR_NAME: 'Autor Fixture',
    GIT_AUTHOR_EMAIL: commit.email,
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.com',
  }
}

function git(ruta: string, args: readonly string[], entorno: NodeJS.ProcessEnv = {}): string {
  return execFileSync('git', ['-C', ruta, ...args], {
    encoding: 'utf8',
    env: { ...ENTORNO_AISLADO, ...entorno },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
