# #2 — análisis: pulso y gente (walkHistory → cubos, autores, tendencia, KPIs y concentración)

> **This plan is written to be executed by task-scoped subagents with zero context and no
> authority to decide.** Every diff embeds the current state (copied verbatim from the repo)
> and the complete final state. Do not improvise: follow the tasks literally. On ambiguity,
> the issue body and AGENTS.md win.

## 1. Context and goal

El repo tiene el esqueleto del slice #1 y nada de dominio: `server/src/` solo contiene
`app.ts` (factoría de Express con `GET /api/health`), `index.ts` (arranque) y `app.test.ts`.
No existe `server/src/analysis/`, ni ningún código que ejecute `git`, ni helpers de test. El
issue #2 pide ese módulo: `walkHistory(repo, ventana)` recorre el historial de HEAD del clon
y devuelve los cubos de commits, la serie de autores por cubo, la tendencia frente a la
ventana anterior, los KPIs y la concentración de autoría. Es un módulo puro de análisis: el
único código del repo autorizado a lanzar `git`, y la frontera donde mueren los emails de
autor.

### Desired end state

- `server/src/analysis/index.ts` exporta
  `walkHistory(repo: string, ventana: Ventana, opciones?): Promise<Analisis>`.
- Con un fixture de fechas conocidas (10 commits sin merges + 1 merge), los cubos suman el
  total de commits sin merges en las cuatro ventanas (`30d`, `90d`, `12m`, `all`).
- Dos emails del mismo autor que difieren en mayúsculas cuentan como un autor (y `.mailmap`
  se respeta).
- En ventana `all` la tendencia es `porcentaje: null` con `comparable: false` y
  `motivo: 'ventana-completa'`.
- La concentración es el mínimo nº de autores que suma el 80% o más de los commits de la
  ventana.
- Ningún email ni nombre de autor aparece en el tipo `Analisis` que devuelve el módulo.
- `npm run build && npm test && npm run lint` siguen en exit 0, y ahora el build de `server/`
  también hace typecheck de los ficheros de test.

### Out of scope

- 🚫 Nada de Express ni de UI en este slice (literal del issue): no se toca `server/src/app.ts`,
  ni `server/src/index.ts`, ni `server/src/app.test.ts`, ni nada de `web/`. El módulo no se
  cablea a ninguna ruta HTTP: eso es de otro slice.
- El Calor (reparto por carpeta, carpeta principal, navegación del árbol) no entra: este slice
  entrega Pulso y Gente. Las exclusiones de ruido sí se implementan, porque el epic las aplica
  también al KPI de ficheros tocados, que sí es de este slice.
- Sin caché: la caché en memoria por (repo, ventana, sha de HEAD) la monta quien sirva la API.
  Este slice solo expone `leerHeadSha` para que pueda construir la clave sin ejecutar `git`
  por su cuenta.
- Sin escaneo de la raíz de clones, sin `id` de repo, sin settings persistidos y sin el aviso
  de foto desactualizada (`.git/FETCH_HEAD`): nada de eso lo pide el issue.
- Sin migraciones: el epic fija "Sin base de datos", así que no hay esquema que migrar ni
  rollback de datos que escribir. El rollback de este slice es revertir sus commits.
- La sección "Formato de la tabla de slices (contrato con /ct-groom)" de AGENTS.md, y los dos
  marcadores que la preceden, no se tocan: los mantiene `/ct-init`.

## 2. Closed decisions (do NOT reopen)

| Decision | Value |
|---|---|
| Punto de entrada | `walkHistory(repo, ventana, opciones)` en `server/src/analysis/index.ts`, `async`, devuelve `Promise<Analisis>` |
| Instante de referencia | `opciones.ahora?: Date` (default `new Date()`): sin él los tests de ventanas relativas caducarían solos |
| Nombres | Dominio en español (`ventana`, `cubos`, `autores`, `tendencia`, `concentracion`); `walkHistory` conserva el nombre que fija el issue |
| Ventanas | `30d` = 30 cubos de 1 día; `90d` = 13 cubos de 7 días; `12m` = 52 cubos de 7 días; `all` = cubos de mes natural UTC. Default `12m` |
| Longitud de ventana | nº de cubos × tamaño de cubo, acabando en `ahora`: 30, 91 y 364 días. Así la ventana anterior es exactamente igual de larga |
| Ventana `all` | Del mes del primer commit al mes del último commit o de `ahora` (el más tardío), inclusive: en `all` no se pierde ni un commit |
| Zona horaria | Todos los límites de cubo en UTC; `inicio`, `desde` y `hasta` en ISO 8601 UTC |
| Límites de cubo | `[inicio, siguiente)`; el fin de la ventana es exclusivo |
| Commits contados | Solo los alcanzables desde HEAD y sin merges (`git log HEAD --no-merges`) |
| Autor | `%aE` (aplica `.mailmap`) pasado a minúsculas y recortado; `%ae` NO aplica `.mailmap` y no se usa |
| Fuga de datos | El tipo `Analisis` no tiene ningún campo de identidad de autor: solo conteos y porcentajes. El email es clave de un `Map` interno y muere en el módulo |
| Renames | `--no-renames`: un rename es un path nuevo |
| Commit raíz | `--root`, para que sus ficheros cuenten en el KPI de ficheros tocados |
| Tendencia | `Math.round((commits / commitsAnteriores - 1) * 100)`; `null` con `comparable: false` si no hay comparable (`all`) o si la ventana anterior tiene 0 commits, cada caso con su `motivo` |
| Concentración | Conteos por autor en orden descendente, acumulando hasta `acumulado * 100 >= 80 * total` (comparación entera, sin flotantes); sin commits → `{ autores: 0, porcentaje: 0 }` |
| Serie de la ventana anterior | `cubosVentanaAnterior: number[] \| null` — la maqueta dibuja la ventana anterior en gris; en `all` es `null` |
| Ruido | Nombres exactos de lockfiles, sufijos `.min.js` y `.map`, y cualquier ruta con un segmento `dist`, `build` o `vendor`. Solo afecta al KPI de ficheros tocados |
| Repo sin commits | `headSha: null`, cubos de la ventana a cero (en `all`, lista vacía). No es un error |
| Carpeta sin `.git` | `ErrorAnalisis` con `codigo: 'no-es-repo-git'` |
| Ejecución de git | `promisify(execFile)` con `maxBuffer` de 64 MB y `encoding: 'utf8'`; nunca `git fetch`/`pull`, nunca escribe en el clon |
| Config de git en producción | Se respeta la del usuario (incluido `mailmap.file`): NO se neutraliza `GIT_CONFIG_GLOBAL` en el código de producción |
| Config de git en fixtures | El helper de fixtures sí aísla `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` y fuerza `commit.gpgsign=false`: la config personal del dev no puede romper la creación de commits |
| Fixtures | Repos git de verdad en `tmp` con `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` fijadas; jamás contra clones reales de la máquina |
| Typecheck de tests | `server/tsconfig.json` compila todo `src` con `noEmit`; `server/tsconfig.build.json` emite `dist/` excluyendo tests y helpers (cierra la decisión abierta que AGENTS.md asigna a este slice) |
| Migración | N/A — el epic fija "Sin base de datos". Forward = aplicar los commits; rollback = revertirlos. No hay estado persistido que migrar |

## 3. Reference patterns

- `server/src/app.ts` — estilo del módulo de `server/`: ESM, `export function`, `import type`
  separado del import de valores.
- `server/src/app.test.ts` — estilo de test: `import { expect, test } from 'vitest'`, un
  `test(...)` por comportamiento con nombre en español, import relativo con sufijo `.js`.
- `server/tsconfig.json` y `server/package.json` — el patrón de configuración que la tarea 1
  extiende (un tsconfig de typecheck y otro de emit, como ya hace `web/` con
  `tsc --noEmit` + `vite build`).
- `docs/superpowers/plans/2026-08-13-issue-1-esqueleto.md` — formato de plan del repo.
- `docs/design/repo-pulse-mockup.html` — referencia visual obligatoria. De ella sale el
  vocabulario que este módulo tiene que alimentar: Pulso (commits por cubo, con la ventana
  anterior en gris), Gente (autores activos por cubo), la tendencia frente a la ventana
  anterior, los tres KPIs (commits, autores activos, ficheros tocados) y la frase de
  concentración (N personas concentran X% de los commits).

## 4. Inventory

| Fichero | Acción | Lo consume |
|---|---|---|
| `server/tsconfig.json` | modificar | `npm run build -w server` (typecheck), editores |
| `server/tsconfig.build.json` | crear | `npm run build -w server` (emit a `dist/`) |
| `server/package.json` | modificar (script `build`) | CI, `npm run build` |
| `server/src/analysis/tipos.ts` | crear | todo el módulo; el slice de API leerá estos tipos |
| `server/src/analysis/ruido.ts` | crear | `agregado.ts`; el slice del Calor lo reutilizará |
| `server/src/analysis/ventanas.ts` | crear | `agregado.ts`, `index.ts` |
| `server/src/analysis/git.ts` | crear | `index.ts` |
| `server/src/analysis/agregado.ts` | crear | `index.ts` |
| `server/src/analysis/index.ts` | crear | el slice que sirva la API |
| `server/src/testing/repo-fixture.ts` | crear | tests del análisis y, más adelante, de la API |
| `server/src/testing/repo-fixture.test.ts` | crear | `npm test -w server` |
| `server/src/analysis/ruido.test.ts` | crear | `npm test -w server` |
| `server/src/analysis/ventanas.test.ts` | crear | `npm test -w server` |
| `server/src/analysis/git.test.ts` | crear | `npm test -w server` |
| `server/src/analysis/agregado.test.ts` | crear | `npm test -w server` |
| `server/src/analysis/index.test.ts` | crear | `npm test -w server` (los 4 AC del issue) |
| `AGENTS.md` | modificar (4 tramos, ninguno del contrato de slices) | agentes de los slices siguientes |

## 5. Interfaces

Consumes: `merge-after #1` — el issue no declara ninguna interfaz de código, solo que el
esqueleto esté mergeado. De él se dan por hechos, y se usan tal cual:

- Workspace `server/` con TS estricto vía `tsconfig.base.json` (`strict`,
  `noUncheckedIndexedAccess`, `verbatimModuleSyntax`) y ESM (`"type": "module"`).
- Comandos raíz `npm run build`, `npm test`, `npm run lint` como criterio de verificación.
- Vitest por workspace, ficheros `*.test.ts` junto al código.
- Imports relativos con sufijo `.js` en `server/`.

Produces (superficie pública nueva; es el cambio de API que este slice reporta, y no hay
cambio de API HTTP porque Express queda fuera de alcance):

```ts
// server/src/analysis/index.ts
export interface OpcionesWalkHistory { ahora?: Date }
export function walkHistory(repo: string, ventana: Ventana, opciones?: OpcionesWalkHistory): Promise<Analisis>
export function leerHeadSha(repo: string): Promise<string | null>
export class ErrorAnalisis extends Error { readonly codigo: CodigoErrorAnalisis }
export const VENTANAS: readonly Ventana[]
export const VENTANA_POR_DEFECTO: Ventana
export function esVentana(valor: string): valor is Ventana

export type Ventana = '30d' | '90d' | '12m' | 'all'
export type TamanoCubo = 'dia' | 'semana' | 'mes'
export type MotivoNoComparable = 'ventana-completa' | 'sin-commits-previos'
export type CodigoErrorAnalisis = 'no-es-repo-git' | 'git-ha-fallado'
export interface Cubo { inicio: string; commits: number; autores: number }
export interface Tendencia {
  comparable: boolean
  porcentaje: number | null
  commitsVentanaAnterior: number | null
  motivo: MotivoNoComparable | null
}
export interface Kpis { commits: number; autoresActivos: number; ficherosTocados: number }
export interface Concentracion { autores: number; porcentaje: number }
export interface Analisis {
  ventana: Ventana
  cubo: TamanoCubo
  desde: string | null
  hasta: string
  headSha: string | null
  cubos: Cubo[]
  cubosVentanaAnterior: number[] | null
  tendencia: Tendencia
  kpis: Kpis
  concentracion: Concentracion
}
```

Además cambia el contrato de build de `server/`: `npm run build -w server` pasa de un solo
`tsc -p tsconfig.json` a typecheck de todo `src` (tests incluidos) más emit con
`tsconfig.build.json`. La ruta de salida sigue siendo `server/dist/` y `npm start` no cambia.

## 6. Test strategy

Vitest en `server/`, ejecutado con `npm test`. Tres niveles:

1. **Puro, sin git** — `ruido.test.ts`, `ventanas.test.ts` y `agregado.test.ts` cubren la
   aritmética (límites de cubo, ventana anterior, redondeos, umbral del 80%, casos con cero
   commits) sobre datos construidos a mano. Son los tests que fijan los bordes.
2. **Contra git de verdad** — `git.test.ts` sobre repos fixture creados en `tmp`: merges
   excluidos, email en minúsculas, `.mailmap` aplicado, ficheros del commit raíz, repo vacío,
   carpeta sin `.git`.
3. **Aceptación** — `index.test.ts` traduce los cuatro criterios del issue 1:1, con sus
   nombres literales, contra un fixture de fechas conocidas, y añade la comprobación de que
   ningún email sale del módulo.

Reglas para el implementador:

- Nunca contra clones reales de la máquina: todo repo de test se crea con
  `crearRepoFixture` y se borra con `limpiar()` en `afterAll`/`finally`.
- El "total de commits sin merges" con el que se compara no se escribe a mano: lo da
  `commitsSinMerges(ruta)`, que pregunta a `git rev-list --no-merges --count HEAD`.
- Todas las llamadas a `walkHistory` en tests pasan `{ ahora: AHORA }`: sin instante fijo los
  tests caducan.
- La tarea 1 (tsconfig) y la tarea 8 (AGENTS.md) no llevan tests unitarios: no introducen
  comportamiento. Su verificación son los comandos exactos que listan. No inventes tests
  para ellas.

## 7. Tasks

### Task 1 — tsconfig de server: typecheck de los tests, emit sin ellos

**Objective:** `npm run build -w server` hace typecheck de todo `server/src` (tests incluidos)
y emite a `dist/` solo el código de producción, cerrando la decisión abierta que AGENTS.md
asigna a este slice.

**Files:** `server/tsconfig.json` (modificar), `server/tsconfig.build.json` (crear),
`server/package.json` (modificar solo el script `build`).

Current state (server/tsconfig.json):

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

Contenido final completo de `server/tsconfig.json` (typecheck de TODO `src`, sin emitir):

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src"]
}
```

Fichero `server/tsconfig.build.json`.

Current state: does not exist.

Final content:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "rootDir": "src",
    "outDir": "dist"
  },
  "exclude": ["src/**/*.test.ts", "src/testing"]
}
```

Current state (server/package.json):

```json
{
  "name": "server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^5.1.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.1",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "vitest": "^3.0.4"
  }
}
```

Contenido final completo de `server/package.json` (cambia UNA línea, la del script `build`):

```json
{
  "name": "server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit -p tsconfig.json && tsc -p tsconfig.build.json",
    "test": "vitest run",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^5.1.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.1",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "vitest": "^3.0.4"
  }
}
```

**TDD:** No TDD — configuración de compilador. La comprobación de que de verdad hace lo que
dice está en Verification: un error de tipos metido a mano en un test tiene que romper el
build, y desaparecer del `dist/`.

**Tests:** N/A — no introduce comportamiento; lo verifican los comandos de abajo.

**Verification:**

```bash
npm run build -w server; echo "exit=$?"
ls server/dist
```

Se espera `exit=0` y que `ls server/dist` liste `app.js` e `index.js` y NINGÚN `*.test.js`.
Después, la prueba de que el typecheck alcanza los tests:

```bash
printf 'const roto: number = "no"\nexport default roto\n' > server/src/roto.test.ts
npm run build -w server; echo "exit=$?"
rm server/src/roto.test.ts
npm run build -w server; echo "exit=$?"
```

Se espera `exit=2` (error TS2322 en `server/src/roto.test.ts`) en la primera y `exit=0` en la
segunda. Si la primera diese `exit=0`, el typecheck no está mirando los tests: revisa que
`server/tsconfig.json` ya no tenga `exclude`.

### Task 2 — Contratos del módulo y helper de repos fixture

**Objective:** existen los tipos del análisis y un helper que crea repos git de verdad en
`tmp` con fechas de autor fijadas, con su propio test en verde.

**Files:** `server/src/analysis/tipos.ts`, `server/src/testing/repo-fixture.ts`,
`server/src/testing/repo-fixture.test.ts` (los tres nuevos).

Fichero `server/src/analysis/tipos.ts`.

Current state: does not exist.

Final content:

```ts
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
```

Fichero `server/src/testing/repo-fixture.ts`.

Current state: does not exist.

Final content:

```ts
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
```

Fichero `server/src/testing/repo-fixture.test.ts`.

Current state: does not exist.

Final content:

```ts
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
```

**TDD:** Rojo primero: crea `server/src/testing/repo-fixture.test.ts` y ejecuta
`npm test -w server`; confirma que falla porque no puede resolver `./repo-fixture.js`. Después
crea `repo-fixture.ts` tal cual y vuelve a ejecutarlo: los tres tests pasan.
`server/src/analysis/tipos.ts` no lleva tests: son solo tipos, no hay comportamiento (lo
cubre el typecheck de la tarea 1).

**Tests:** añadidos: `crearRepoFixture crea un repo git con los commits pedidos y el merge no
cuenta`, `crearRepoFixture sin commits deja un repo git vacío`, `limpiar borra el directorio
del fixture`. Ninguno eliminado.

**Verification:** `npm test -w server` → exit 0, con los 3 tests nuevos más el de
`app.test.ts` en verde. `npm run build -w server` → exit 0 y `ls server/dist` NO contiene
`testing/` (el helper está excluido del emit).

### Task 3 — Exclusiones de ruido

**Objective:** una función pura decide si una ruta es ruido generado, con las reglas exactas
del epic.

**Files:** `server/src/analysis/ruido.ts`, `server/src/analysis/ruido.test.ts` (los dos nuevos).

Fichero `server/src/analysis/ruido.ts`.

Current state: does not exist.

Final content:

```ts
/**
 * Ruido generado: ficheros que no dicen nada del trabajo humano. Solo afectan al
 * KPI de ficheros tocados (y, más adelante, al reparto por carpeta): NUNCA al
 * conteo de commits ni de autores.
 */

const FICHEROS_RUIDO = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  'Gemfile.lock',
  'go.sum',
])

const CARPETAS_RUIDO = new Set(['dist', 'build', 'vendor'])

export function esRuido(ruta: string): boolean {
  const segmentos = ruta.split('/')
  if (segmentos.some((segmento) => CARPETAS_RUIDO.has(segmento))) return true
  const nombre = segmentos.at(-1) ?? ''
  if (FICHEROS_RUIDO.has(nombre)) return true
  return nombre.endsWith('.min.js') || nombre.endsWith('.map')
}
```

Fichero `server/src/analysis/ruido.test.ts`.

Current state: does not exist.

Final content:

```ts
import { expect, test } from 'vitest'
import { esRuido } from './ruido.js'

test.each([
  'package-lock.json',
  'web/package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  'Gemfile.lock',
  'go.sum',
  'web/assets/app.min.js',
  'web/assets/app.js.map',
  'dist/index.js',
  'server/dist/index.js',
  'build/salida.txt',
  'vendor/lib/cosa.rb',
])('«%s» es ruido', (ruta) => {
  expect(esRuido(ruta)).toBe(true)
})

test.each([
  'src/index.ts',
  'server/src/analysis/index.ts',
  'web/src/App.tsx',
  'README.md',
  'package.json',
  'src/distribucion.ts',
  'src/builder.ts',
  'src/vendors.ts',
])('«%s» no es ruido', (ruta) => {
  expect(esRuido(ruta)).toBe(false)
})
```

**TDD:** Rojo primero: crea `ruido.test.ts` y ejecuta `npm test -w server`; falla porque no
resuelve `./ruido.js`. Crea `ruido.ts` tal cual: los 22 casos pasan. Los tres últimos casos
del segundo bloque son deliberados: `distribucion`, `builder` y `vendors` contienen `dist`,
`build` y `vendor` como subcadena y NO son ruido — la comparación es por segmento de ruta
completo, no por subcadena.

**Tests:** añadidos: `«%s» es ruido` (14 casos) y `«%s» no es ruido` (8 casos). Ninguno
eliminado.

**Verification:** `npm test -w server` → exit 0, 22 tests nuevos en verde.

### Task 4 — Ventanas y rejilla de cubos

**Objective:** las cuatro ventanas del epic producen su rejilla de cubos, su ventana anterior
de igual longitud y el índice de cubo de una fecha.

**Files:** `server/src/analysis/ventanas.ts`, `server/src/analysis/ventanas.test.ts` (los dos
nuevos).

Fichero `server/src/analysis/ventanas.ts`.

Current state: does not exist.

Final content:

```ts
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
```

Fichero `server/src/analysis/ventanas.test.ts`.

Current state: does not exist.

Final content:

```ts
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
```

**TDD:** Rojo primero: crea `ventanas.test.ts` y ejecuta `npm test -w server`; falla porque no
resuelve `./ventanas.js`. Crea `ventanas.ts` tal cual: los 8 tests pasan.

**Tests:** añadidos: `las ventanas son las cuatro del spec y la de por defecto es 12m`,
`esVentana solo acepta las cuatro ventanas`, `30d son 30 cubos de un día que acaban en ahora`,
`90d son 13 cubos semanales y 12m son 52`, `la ventana anterior mide lo mismo y acaba donde
empieza la actual`, `all va del mes del primer commit al mes de ahora y no tiene comparable`,
`all sin commits no tiene ningún cubo`, `el cubo incluye su inicio y la ventana excluye su
fin`. Ninguno eliminado.

**Verification:** `npm test -w server` → exit 0. `npm run build -w server` → exit 0.

### Task 5 — Lectura de git: el único código que lanza git

**Objective:** `leerHistorial(repo)` devuelve el sha de HEAD y los commits sin merges con el
email de autor en minúsculas y `.mailmap` aplicado; `leerHeadSha(repo)` da la clave de caché
sin recorrer el historial.

**Files:** `server/src/analysis/git.ts`, `server/src/analysis/git.test.ts` (los dos nuevos).

Fichero `server/src/analysis/git.ts`.

Current state: does not exist.

Final content:

```ts
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Commit } from './tipos.js'

const ejecutar = promisify(execFile)

/** Salida máxima de `git log` que aceptamos en memoria (repos con decenas de miles de commits). */
const MAX_SALIDA = 64 * 1024 * 1024

const SEPARADOR_REGISTRO = '\u0000'
const SEPARADOR_CAMPO = '\u001f'

/**
 * `%aI` = fecha de autor en ISO 8601 estricto. `%aE` = email de autor CON
 * `.mailmap` aplicado; `%ae` (minúscula) no lo aplica y por eso no se usa.
 */
const FORMATO = '%x00%H%x1f%aI%x1f%aE'

/**
 * `--no-merges`: los merges no son trabajo. `--no-renames`: un rename es un path
 * nuevo. `--root`: sin él, los ficheros del commit raíz no aparecerían.
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
```

Fichero `server/src/analysis/git.test.ts`.

Current state: does not exist.

Final content:

```ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { ErrorAnalisis, leerHeadSha, leerHistorial, parsearHistorial } from './git.js'
import { commitsSinMerges, crearRepoFixture } from '../testing/repo-fixture.js'
import type { CommitFixture, RepoFixture } from '../testing/repo-fixture.js'

const COMMITS: readonly CommitFixture[] = [
  { fecha: '2026-07-20T09:00:00+00:00', email: 'ana@example.com', ficheros: ['src/a.ts'] },
  { fecha: '2026-07-21T09:00:00+00:00', email: 'Ana@Example.com', ficheros: ['src/b.ts'] },
  { fecha: '2026-07-22T09:00:00+00:00', email: 'bea@example.com', ficheros: ['src/f.ts'] },
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

test('leerHistorial devuelve los commits sin merges de HEAD con el email en minúsculas', async () => {
  const { headSha, commits } = await leerHistorial(fixture.ruta)

  expect(headSha).toMatch(/^[0-9a-f]{40}$/)
  expect(commits).toHaveLength(commitsSinMerges(fixture.ruta))
  expect(commits).toHaveLength(5)
  expect(new Set(commits.map((commit) => commit.autor))).toEqual(
    new Set(['ana@example.com', 'bea@example.com', 'cris@example.com', 'dani@example.com']),
  )
})

test('leerHistorial incluye los ficheros del commit raíz', async () => {
  const { commits } = await leerHistorial(fixture.ruta)

  expect(commits.at(-1)?.ficheros).toEqual(['src/a.ts'])
})

test('leerHistorial aplica .mailmap', async () => {
  const conMailmap = crearRepoFixture({
    commits: COMMITS,
    mailmap: 'Ana <ana@example.com> <bea@example.com>\n',
  })

  try {
    const { commits } = await leerHistorial(conMailmap.ruta)

    expect(new Set(commits.map((commit) => commit.autor))).toEqual(
      new Set(['ana@example.com', 'cris@example.com']),
    )
  } finally {
    conMailmap.limpiar()
  }
})

test('un repo git sin commits no tiene HEAD ni historial', async () => {
  const vacio = crearRepoFixture()

  try {
    expect(await leerHeadSha(vacio.ruta)).toBeNull()
    expect(await leerHistorial(vacio.ruta)).toEqual({ headSha: null, commits: [] })
  } finally {
    vacio.limpiar()
  }
})

test('una carpeta que no es repo git falla con el código no-es-repo-git', async () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'repo-pulse-sin-git-'))

  try {
    await expect(leerHistorial(carpeta)).rejects.toThrow(ErrorAnalisis)
    await expect(leerHistorial(carpeta)).rejects.toMatchObject({ codigo: 'no-es-repo-git' })
  } finally {
    rmSync(carpeta, { recursive: true, force: true })
  }
})

test('parsearHistorial lee el formato de git log con separadores NUL y US', () => {
  const salida =
    '\u0000abc\u001f2026-08-01T10:00:00Z\u001fAna@Example.com\nsrc/a.ts\n\n' +
    '\u0000def\u001f2026-07-31T10:00:00Z\u001fbea@example.com\n'

  expect(parsearHistorial(salida)).toEqual([
    {
      sha: 'abc',
      fecha: Date.parse('2026-08-01T10:00:00Z'),
      autor: 'ana@example.com',
      ficheros: ['src/a.ts'],
    },
    {
      sha: 'def',
      fecha: Date.parse('2026-07-31T10:00:00Z'),
      autor: 'bea@example.com',
      ficheros: [],
    },
  ])
})
```

**TDD:** Rojo primero: crea `git.test.ts` y ejecuta `npm test -w server`; falla porque no
resuelve `./git.js`. Crea `git.ts` tal cual y vuelve a ejecutarlo: los 6 tests pasan. Si el
test del `.mailmap` fallase devolviendo `bea@example.com`, el formato está usando `%ae` en vez
de `%aE`: es el único sitio donde importa la mayúscula.

**Tests:** añadidos: `leerHistorial devuelve los commits sin merges de HEAD con el email en
minúsculas`, `leerHistorial incluye los ficheros del commit raíz`, `leerHistorial aplica
.mailmap`, `un repo git sin commits no tiene HEAD ni historial`, `una carpeta que no es repo
git falla con el código no-es-repo-git`, `parsearHistorial lee el formato de git log con
separadores NUL y US`. Ninguno eliminado.

**Verification:** `npm test -w server` → exit 0. `npm run lint` → exit 0.

### Task 6 — Agregado: cubos, serie de autores, KPIs, tendencia y concentración

**Objective:** una función pura convierte los commits y un instante de referencia en cubos,
serie de autores, KPIs, tendencia y concentración, sin volver a preguntar a git.

**Files:** `server/src/analysis/agregado.ts`, `server/src/analysis/agregado.test.ts` (los dos
nuevos).

Fichero `server/src/analysis/agregado.ts`.

Current state: does not exist.

Final content:

```ts
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
```

Fichero `server/src/analysis/agregado.test.ts`.

Current state: does not exist.

Final content:

```ts
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
```

**TDD:** Rojo primero: crea `agregado.test.ts` y ejecuta `npm test -w server`; falla porque no
resuelve `./agregado.js`. Crea `agregado.ts` tal cual: los 8 tests pasan.

**Tests:** añadidos: `la concentración es el mínimo nº de autores que suma el 80% o más`,
`sin commits la concentración no tiene autores`, `la tendencia compara con la ventana anterior
de igual longitud`, `sin commits en la ventana anterior la tendencia no es comparable`, `sin
ventana anterior la tendencia no es comparable`, `cada cubo lleva sus commits y sus autores
distintos, y lo de fuera no cuenta`, `el KPI de ficheros tocados no cuenta ruido generado`,
`en all los cubos son meses y no hay serie de la ventana anterior`. Ninguno eliminado.

**Verification:** `npm test -w server` → exit 0. `npm run build -w server` → exit 0.

### Task 7 — walkHistory y los cuatro criterios de aceptación

**Objective:** `walkHistory(repo, ventana)` entrega el análisis completo, y los cuatro
criterios de aceptación del issue pasan contra un fixture de fechas conocidas.

**Files:** `server/src/analysis/index.ts`, `server/src/analysis/index.test.ts` (los dos nuevos).

Fichero `server/src/analysis/index.ts`.

Current state: does not exist.

Final content:

```ts
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
export type { CodigoErrorAnalisis, Historial } from './git.js'
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
```

Fichero `server/src/analysis/index.test.ts`.

Current state: does not exist.

Final content:

```ts
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
```

**TDD:** Rojo primero: crea `index.test.ts` y ejecuta `npm test -w server`; falla porque no
resuelve `./index.js`. Crea `index.ts` tal cual y vuelve a ejecutarlo: los 8 tests pasan, con
los cuatro criterios de aceptación del issue entre ellos. Si `expect(total).toBe(10)` fallase,
el fixture no se ha creado con los 9 commits más el de la rama: revisa la tarea 2 antes de
tocar el agregado.

**Tests:** añadidos: `con un fixture de fechas conocidas los cubos suman el total de commits
sin merges` (AC 1), `dos emails del mismo autor que difieren en mayúsculas cuentan como un
autor` (AC 2), `en ventana \`all\` la tendencia es null y se declara no comparable` (AC 3),
`la concentración es el mínimo nº de autores que suma el 80% o más` (AC 4), `el análisis no
expone ningún email de autor`, `la tendencia se cuenta contra la ventana anterior de igual
longitud`, `un repo sin commits devuelve la ventana a cero y sin HEAD`, `el KPI de ficheros
tocados ignora lockfiles, bundles y rutas generadas`. Ninguno eliminado.

**Verification:**

```bash
npm test -w server; echo "exit=$?"
npm run build -w server; echo "exit=$?"
ls server/dist/analysis
```

Se espera exit 0 en las dos, y que `server/dist/analysis` contenga `index.js`, `agregado.js`,
`git.js`, `ruido.js`, `tipos.js` y `ventanas.js`, sin ningún `*.test.js`.

### Task 8 — AGENTS.md al día

**Objective:** AGENTS.md describe el build real de `server/`, el módulo de análisis y sus
trampas, y ya no arrastra la decisión abierta que este slice ha cerrado.

**Files:** `AGENTS.md` — SOLO los cuatro tramos citados abajo. Desde la línea que empieza por
`## Formato de la tabla de slices` hasta el final del fichero, y los dos marcadores que la
preceden, no se modifica ni un byte.

Reemplazo A — la sección "Build, test & lint" completa.

Current state (AGENTS.md, lines 12-18):

```
## Build, test & lint
Desde la raíz; cada comando cubre ambos workspaces:
- `npm run build` — `server/`: `tsc` → `dist/`; `web/`: `tsc --noEmit` + `vite build`.
- `npm test` — Vitest (`vitest run`) en cada workspace.
- `npm run lint` — ESLint 9 (flat config en `eslint.config.js`) sobre todo el repo.
La CI (`.github/workflows/ci.yml`) ejecuta build+test+lint en cada PR y en cada
push a `main`.
```

Ese tramo pasa a ser exactamente:

```
## Build, test & lint
Desde la raíz; cada comando cubre ambos workspaces:
- `npm run build` — `server/`: typecheck de todo `src` con `tsconfig.json` (tests
  incluidos) y emit a `dist/` con `tsconfig.build.json`; `web/`: `tsc --noEmit` +
  `vite build`.
- `npm test` — Vitest (`vitest run`) en cada workspace.
- `npm run lint` — ESLint 9 (flat config en `eslint.config.js`) sobre todo el repo.
La CI (`.github/workflows/ci.yml`) ejecuta build+test+lint en cada PR y en cada
push a `main`.
```

Reemplazo B — una línea nueva al final de "Code style & conventions".

Current state (AGENTS.md, lines 20-27):

```
## Code style & conventions
- TypeScript estricto (`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`); ESM en todo el repo (`"type": "module"`).
- ESLint flat config: `@eslint/js` recommended + `typescript-eslint` recommended.
- Tests con Vitest junto al código: `*.test.ts` / `*.test.tsx`.
- En `server/` los imports relativos llevan sufijo `.js` (ESM + NodeNext); en
  `web/` no lo llevan (resolución de bundler). No unifiques las dos: es a
  propósito.
```

Ese tramo pasa a ser exactamente:

```
## Code style & conventions
- TypeScript estricto (`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`); ESM en todo el repo (`"type": "module"`).
- ESLint flat config: `@eslint/js` recommended + `typescript-eslint` recommended.
- Tests con Vitest junto al código: `*.test.ts` / `*.test.tsx`.
- En `server/` los imports relativos llevan sufijo `.js` (ESM + NodeNext); en
  `web/` no lo llevan (resolución de bundler). No unifiques las dos: es a
  propósito.
- Nombres del dominio en español (`ventana`, `cubos`, `autores`, `tendencia`,
  `concentracion`), como la maqueta; `walkHistory` conserva el nombre del spec.
```

Reemplazo C — las seis líneas de dentro del bloque de código de "Project layout" (las dos
vallas de backticks que lo delimitan se dejan intactas).

Current state (AGENTS.md, lines 31-36):

```
server/            # API Express + TS (build → server/dist/)
web/               # UI Vite + React + TS
docs/              # specs, planes y maqueta de referencia
.github/workflows/ # CI: build+test+lint en cada PR
.agent/STATE.md    # estado de la sesión coordinadora (no es producto)
AGENTS.md          # esta guía
```

Esas seis líneas pasan a ser exactamente:

```
server/            # API Express + TS (build → server/dist/)
  src/analysis/    # análisis del historial: ÚNICO código que ejecuta git
  src/testing/     # helpers de test (repos git fixture); fuera del emit
web/               # UI Vite + React + TS
docs/              # specs, planes y maqueta de referencia
.github/workflows/ # CI: build+test+lint en cada PR
.agent/STATE.md    # estado de la sesión coordinadora (no es producto)
AGENTS.md          # esta guía
```

Reemplazo D — la sección "Gotchas" completa, y el primer punto de "Decisiones abiertas", que
este slice ha cerrado.

Current state (AGENTS.md, lines 64-76):

```
## Gotchas
- `vitest run` falla (exit 1) si un workspace se queda sin ficheros de test: no
  borres el último test de un workspace sin sustituirlo.
- Los `*.test.ts` de `server/` están excluidos del build de `tsc`: un error de
  tipos en un test no rompe `npm run build`. No te fíes solo del build.

## Decisiones abiertas entre workspaces (con dueño)
Las creó el esqueleto (#1) y no las cubre el criterio de aceptación de ningún
slice; el dueño las resuelve cuando le toque, en vez de descubrirlas:
- **Typecheck de los tests de `server/`** — hoy no los mira nadie (ver Gotchas).
  Dueño: el slice que traiga `server/src/analysis/`. Salida esperada: un
  `tsconfig` que compile `src` entero y otro que excluya los tests solo del
  emit.
```

Ese tramo pasa a ser exactamente:

```
## Gotchas
- `vitest run` falla (exit 1) si un workspace se queda sin ficheros de test: no
  borres el último test de un workspace sin sustituirlo.
- `npm run build -w server` hace DOS cosas: typecheck de todo `src` (tests
  incluidos) y emit sin tests. Un error de tipos en un test SÍ rompe el build.
- Los tests del análisis crean repos git de verdad en `tmp` con fechas fijadas:
  necesitan `git` en el PATH y jamás tocan clones reales de la máquina.
- En `git log`, `%aE` aplica `.mailmap` y `%ae` no. El análisis usa `%aE` y
  pasa el email a minúsculas: no lo cambies a la variante en minúscula.

## Decisiones abiertas entre workspaces (con dueño)
Las creó el esqueleto (#1) y no las cubre el criterio de aceptación de ningún
slice; el dueño las resuelve cuando le toque, en vez de descubrirlas:
```

Los dos puntos que siguen en esa sección (el del proxy de `web/` en dev y el de la frontera
`web/` → `server/`) se quedan tal cual, igual que el resto del fichero.

**TDD:** No TDD — documentación.

**Tests:** N/A — documentación.

**Verification:**

```bash
grep -c 'ct-init:slices-contract' AGENTS.md
grep -n '^## Formato de la tabla de slices' AGENTS.md
grep -n 'tsconfig.build.json\|src/analysis/\|%aE' AGENTS.md
grep -c 'Typecheck de los tests' AGENTS.md
git diff --unified=0 AGENTS.md | grep '^@@'
```

Se espera: `2` marcadores del contrato intactos, la sección del contrato encontrada, las tres
referencias nuevas presentes, `0` apariciones de la decisión ya cerrada, y hunks SOLO en los
tramos 12-18, 20-27, 31-36 y 64-76 del fichero original.

## 8. Global verification

Con las ocho tareas commiteadas, desde la raíz del worktree:

```bash
npm ci
npm run build && npm test && npm run lint; echo "exit=$?"
```

Se espera `exit=0`. Después, la comprobación de que los cuatro criterios de aceptación están
en verde por su nombre:

```bash
npx vitest run --reporter=verbose --root server src/analysis/index.test.ts
```

Se esperan en verde, literalmente:

- `con un fixture de fechas conocidas los cubos suman el total de commits sin merges`
- `dos emails del mismo autor que difieren en mayúsculas cuentan como un autor`
- `en ventana \`all\` la tendencia es null y se declara no comparable`
- `la concentración es el mínimo nº de autores que suma el 80% o más`

Y las tres comprobaciones de frontera del slice:

```bash
git diff --stat main -- server/src/app.ts server/src/index.ts server/src/app.test.ts web
grep -rn "express" server/src/analysis || echo "sin Express en el análisis"
ls server/dist/analysis server/dist/testing 2>&1
```

Se espera: diff VACÍO contra `main` en `app.ts`, `index.ts`, `app.test.ts` y todo `web/`
(nada de Express ni de UI, que es lo protegido del issue); ninguna mención a Express dentro
de `server/src/analysis`; y que `server/dist/testing` NO exista mientras
`server/dist/analysis` sí, sin ficheros `*.test.js`.

El PR reporta el cambio de API: no hay cambio de API HTTP (Express queda fuera de este slice),
el cambio es la superficie exportada por `server/src/analysis/index.ts` que documenta la
sección 5, más el script `build` de `server/`. Sin migración de datos: el epic fija "Sin base
de datos", así que forward es aplicar los commits y rollback es revertirlos, sin estado
persistido que deshacer.

## 9. Assumptions

1. **Longitud de las ventanas** — el issue no dice cuántos días son `90d` y `12m` en cubos
   semanales. Se toma nº de cubos × tamaño de cubo (30, 91 y 364 días), que es lo que hace la
   maqueta (30, 13 y 52 cubos) y lo que permite que la ventana anterior sea exactamente igual
   de larga. *(Referencia visual obligatoria del epic + propia.)*
2. **`ahora` inyectable** — las ventanas son relativas al presente, así que sin un instante de
   referencia fijo los tests de aceptación caducarían al día siguiente. Se añade
   `opciones.ahora` en vez de acoplar el módulo a un reloj global. *(Propia.)*
3. **UTC** — el issue no fija zona horaria; los cubos se alinean en UTC para que el resultado
   no dependa de la máquina que lo calcula. *(Propia.)*
4. **`all` no pierde commits** — la ventana `all` llega hasta el mes del último commit o de
   `ahora`, el más tardío. Así un commit con fecha de autor en el futuro (reloj mal puesto)
   sigue cayendo en un cubo y el criterio "los cubos suman el total" se cumple sin excepciones.
   *(Propia.)*
5. **Commits fuera de ventana en `30d`/`90d`/`12m`** — quedan fuera del conteo, que es el
   sentido de una ventana. El criterio de aceptación se comprueba con un fixture cuyos commits
   caen todos dentro, y el total con el que se compara lo da
   `git rev-list --no-merges --count HEAD`. *(Propia.)*
6. **Serie de la ventana anterior** — el issue enumera cubos, autores, tendencia, KPIs y
   concentración, pero la maqueta dibuja además la ventana anterior en gris. Se devuelve
   `cubosVentanaAnterior` porque calcularlo cuesta lo mismo que el total que ya hace falta
   para la tendencia, y evita cambiar el contrato cuando llegue la UI. *(Referencia visual
   obligatoria del epic.)*
7. **Tendencia sin commits previos** — el issue solo declara el caso `all`. Cuando la ventana
   anterior tiene 0 commits tampoco hay porcentaje que dar (sería una división por cero), así
   que se declara no comparable con `motivo: 'sin-commits-previos'`, distinto del
   `'ventana-completa'` de `all`. La maqueta también distingue las dos frases. *(Referencia
   visual obligatoria del epic + propia.)*
8. **KPIs** — el issue dice "KPIs" sin enumerarlos; se implementan los tres de la maqueta:
   commits, autores activos y ficheros tocados. *(Referencia visual obligatoria del epic.)*
9. **Exclusiones de ruido en este slice** — el epic las aplica "al Calor y al KPI de ficheros
   tocados"; el Calor es de otro slice, pero el KPI es de este, así que `ruido.ts` entra aquí y
   el slice del Calor lo reutilizará. *(Contexto del epic.)*
10. **Ruido por segmento de ruta** — "rutas bajo `dist/`, `build/`, `vendor/`" se implementa
    comparando segmentos completos de la ruta, no subcadenas: `src/distribucion.ts` no es
    ruido. Los nombres de lockfile se comparan exactos y con distinción de mayúsculas
    (`Cargo.lock`, `Gemfile.lock`), tal y como los escribe el epic. *(Contexto del epic +
    propia.)*
11. **`leerHeadSha` exportado** — la caché por (repo, ventana, sha de HEAD) la monta otro
    slice, pero este módulo es el único que puede ejecutar git: sin este export, quien sirva
    la API tendría que romper esa regla para construir la clave. *(Contexto del epic.)*
12. **Repo sin commits y carpeta sin `.git`** — el issue no los menciona, pero la maqueta
    declara los dos estados y `git log` falla con exit 128 en ambos. Se distinguen: sin
    commits devuelve la ventana a cero con `headSha: null` (no es un error), y sin `.git`
    lanza `ErrorAnalisis` con `codigo: 'no-es-repo-git'`, comprobando la existencia de `.git`
    en el sistema de ficheros para no confundirla con un repo padre. *(Referencia visual
    obligatoria del epic + propia.)*
13. **Config de git** — el código de producción respeta la config del usuario (incluido
    `mailmap.file`); solo el helper de fixtures aísla `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` y
    apaga la firma gpg, porque una config personal (firma obligatoria, hooks, plantillas)
    puede romper la creación de commits del fixture. *(Propia.)*
14. **`maxBuffer` de 64 MB** — `git log --name-only` de un repo de decenas de miles de commits
    puede dar varios MB de salida; 64 MB deja margen sobrado sin streaming, que no aporta nada
    a un MVP local. Si algún día se queda corto, el fallo es explícito
    (`ErrorAnalisis: git-ha-fallado`), no un resultado silenciosamente truncado. *(Propia.)*
15. **Rutas con caracteres raros** — git entrecomilla y escapa las rutas poco habituales en
    `--name-only`; el parser las toma tal cual. Afecta como mucho al conteo de ficheros
    tocados de repos con nombres exóticos, y no a ningún criterio de aceptación. *(Propia.)*
16. **`server/tsconfig.json` y el script `build`** — no lo pide ningún criterio de aceptación
    del issue, pero AGENTS.md asigna explícitamente al "slice que traiga `server/src/analysis/`"
    la decisión abierta del typecheck de los tests, con la salida esperada literal ("un
    `tsconfig` que compile `src` entero y otro que excluya los tests solo del emit"). Este es
    ese slice, y además sus tests son el primer código de test con lógica de verdad del repo.
    *(AGENTS.md.)*
17. **`server/src/testing/` fuera del emit** — el helper de fixtures no es código de
    producción; se excluye de `tsconfig.build.json` para que no acabe en `dist/`, pero SÍ pasa
    el typecheck. *(Propia.)*
18. **Nombres en español y `walkHistory` en inglés** — el issue fija literalmente el nombre
    `walkHistory(repo, ventana)`; el resto del dominio va en español, como los textos de la
    maqueta. *(Issue + contexto del epic.)*
19. **Un test extra de fuga de datos** — el epic prohíbe que los nombres de autor salgan del
    servidor. No es un criterio de aceptación, pero es una regla de seguridad barata de
    blindar: un test comprueba que el JSON del análisis no contiene ningún `@`. *(Contexto del
    epic.)*
