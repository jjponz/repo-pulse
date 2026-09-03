# #38 — la métrica de los campeones: cobertura de líneas por clon y el bloque Campeones

> **This plan is written to be executed by task-scoped subagents that arrive with zero context
> and decide nothing.** Every task carries the current state of what it touches (copied
> verbatim), the contracts it honours and the exact commands that verify it; its bodies are
> yours to write, test-first. Names, signatures, constants and test names come from this
> document, which decided them. On ambiguity, the issue body and AGENTS.md win.

## 1. Context and goal

`server/` sirve hoy cuatro endpoints bajo `/api` desde `server/src/api/routes.ts`: la lista de
clones (`server/src/repos.ts`), el resumen, el calor y los settings, todo sobre el módulo
`server/src/analysis/` (el único que ejecuta git), con caché LRU por clave (`createCache`) y el
sobre de error tipado de `server/src/api/errors.ts`. `web/` pinta Pulso, Gente y Calor:
`web/src/App.tsx` carga repos y summary con `web/src/api/client.ts`, `web/src/Heat.tsx` se carga
solo con su propio `useEffect`, los textos en español viven en `web/src/format.ts` y los tipos
del payload en `web/src/api/types.ts` (que no importa de `server/`).

Este slice añade una métrica nueva, la cobertura de tests de cada clon, leída de los artefactos
de cobertura que YA existen en el clon (lcov, Istanbul, Cobertura) sin ejecutar nada ni salir a
la red; la expone en `GET /api/coverage` como ranking de todos los clones del root, y la pinta
en un bloque nuevo, **Campeones**, con nombre, porcentaje con barra, formato de origen y
antigüedad de la medida, resaltando el clon seleccionado en la cabecera.

### Desired end state

- `GET /api/coverage` responde `{ repos: [...] }` con un entry por clon del root: `id`,
  `percentage` (número con un decimal, o `null`), `lines: { covered, total }` (o `null`),
  `source` (`'lcov' | 'istanbul' | 'cobertura'`, o `null`) y `measuredAt` (ISO 8601 del mtime
  del artefacto, o `null`); ordenado de mayor a menor cobertura, los `null` al final. Nunca
  se inventa un 0 %.
- El server no ejecuta tests ni herramientas ni hace fetch: solo `stat` y lectura de ficheros
  en rutas fijas del clon; un artefacto corrupto o sin líneas no cuenta.
- Parsear un artefacto no se repite mientras su mtime no cambie (caché por ruta y mtime).
- El dashboard muestra el bloque Campeones con el ranking; el clon seleccionado en la cabecera
  va resaltado; un clon sin artefacto dice «Sin datos de cobertura»; sin ningún clon con datos
  el bloque lo dice; un error de la API se pinta como en los demás bloques.
- Ningún nombre ni email de autor en el payload ni en el DOM; `web/` sigue sin importar de
  `server/`; el server sigue escuchando solo en `127.0.0.1`.
- `npm run build`, `npm test` y `npm run lint` en verde desde la raíz.

### Out of scope

Ejecutar tests o herramientas en el clon; leer cobertura de CI o servicios externos (Codecov,
SonarQube…); histórico o tendencia de la cobertura; cobertura por carpeta o fichero (eso sería
Calor); umbrales, alertas o colores «semáforo» configurables. JaCoCo queda fuera de la lista
final de formatos (el issue lo declara deseable y no bloqueante; ver §9). Los artefactos bajo
subcarpetas de workspaces (p. ej. `server/coverage/lcov.info`) no se buscan: las rutas son fijas
y sin recursión. La sección «Out of scope / Protected» del issue no declara ninguno más.

## 2. Closed decisions (take as given)

| Decision | Value |
|---|---|
| Ruta y forma | `GET /api/coverage` → `{ repos: RepoCoveragePayload[] }`; cada entry tiene EXACTAMENTE las claves `id`, `percentage`, `lines`, `source`, `measuredAt`, en ese orden; sin `name` ni ningún campo de autor |
| Formatos y rutas fijas | `lcov`: `coverage/lcov.info`, `lcov.info`; `istanbul`: `coverage/coverage-summary.json`, `coverage-summary.json`; `cobertura`: `coverage/coverage.xml`, `coverage.xml` (relativas a la raíz del clon, sin recursión). JaCoCo fuera |
| Preferencia entre varios artefactos | el de mtime más reciente; a igual mtime, el orden de `COVERAGE_SOURCES` (`lcov` > `istanbul` > `cobertura`); a igual formato, el `path` menor (code unit) |
| Artefacto que no cuenta | una lectura `unusable` (`'unreadable' \| 'oversized' \| 'malformed' \| 'no-lines'`) se salta y se lee el siguiente candidato; sin candidato utilizable, el clon queda `missing` (todo `null` en el wire) |
| Métrica | líneas: `Math.round((covered / total) * 1000) / 10`; `total === 0` es `'no-lines'`; `covered > total`, negativos o no enteros son `'malformed'` |
| lcov | suma `LF:` y `LH:` de todos los records; sin ningún `LF:` → `'no-lines'`; texto sin `SF:` ni `end_of_record` → `'malformed'`; un `LF:`/`LH:` no numérico → `'malformed'` |
| Istanbul | `total.lines.total` y `total.lines.covered` de `coverage-summary.json`; sin `total` o JSON inválido → `'malformed'`; sin `total.lines` → `'no-lines'`; el resto de claves se ignora (proyección) |
| Cobertura | atributos `lines-valid` (total) y `lines-covered` del elemento raíz `<coverage …>`, comillas simples o dobles; sin `<coverage` → `'malformed'`; sin alguno de los dos atributos → `'no-lines'`; no se recorren `<line>` |
| Fecha de la medida | `measuredAt` = `mtime` del artefacto leído, en ISO 8601 UTC; la UI la pinta con `measuredAgo` |
| Caché | decorador `CachedArtifactReader` sobre el `Cache<T>` de `server/src/api/routes.ts`, clave `path` + NUL + `measuredAt.getTime()`; se cachean también las lecturas `unusable` |
| Tope de tamaño | `MAX_ARTIFACT_BYTES = 64 * 1024 * 1024`, decidido en `createDeps` e inyectado al reader; por encima → `'oversized'` sin leer el fichero |
| Aviso de artefacto descartado | el reader de filesystem emite `console.warn(\`repo-pulse: ignoring ${path}: ${reason}\`)` una vez por lectura `unusable`, como hace `server/src/repos.ts` con lo que degrada |
| Capas del módulo nuevo | `server/src/coverage/domain` (valores, puertos, políticas, error), `server/src/coverage/application` (el caso de uso), `server/src/coverage/infrastructure` (adaptadores, parsers, payload). El dominio no importa de `node:*` ni de otras capas; la aplicación no importa de infraestructura |
| Estilo de los módulos nuevos | sin comentarios ni docstrings; toda función cuelga de un tipo (clase con métodos o estáticos); en inglés. Los módulos existentes que se tocan (`routes.ts`, `app.ts`, `types.ts`, `client.ts`, `format.ts`, tests) siguen el estilo de su host |
| Seam de la API | `AppDeps.coverage: Pick<ReadCoverageRanking, 'execute'>`; la ruta hace `CoveragePayload.of(await deps.coverage.execute())`; el grafo se monta en `createDeps` |
| Catálogo de clones | el caso de uso depende del puerto de dominio `CloneCatalog` (`list(): Promise<readonly CloneRef[]>`), que `deps.catalog` satisface estructuralmente: `Clone` tiene `id` y `path` |
| Orden del ranking | `measured` antes que `missing`; entre medidos, `percentage()` descendente y empate por `id` ascendente (code unit); entre `missing`, `id` ascendente |
| Componentes React | `export default function` como los bloques existentes (contrato del framework: los hooks solo viven en componentes función); todo lo demás del código web nuevo cuelga de un tipo |
| Ubicación del bloque | `<Champions>` es una sección a ancho completo bajo el grid de dos columnas, montada siempre (no depende del summary ni de la ventana); carga `GET /api/coverage` UNA vez al montar |
| Nombre de la fila | `nameOf(id)` que el shell pasa como prop (`repoNameOf(repos, id)`: el nombre del clon, con el id como fallback); el payload no lleva `name` |
| Resaltado | la fila del `repoId` seleccionado lleva `aria-current="true"` y `background: var(--color-surface)`; las demás no llevan `aria-current` |
| Barra | ancho `${percentage}%` en `var(--color-accent)`; sin colores por umbral |
| Textos | `coverageLabel` → `'85,3%'` (es-ES, un decimal); `coverageSourceLabel` → `'lcov'`/`'Istanbul'`/`'Cobertura'`; `measuredAgo` → `` `medida ${relativeDays(iso, now)} · ${formatDay(iso)}` ``; clon sin datos: `Sin datos de cobertura`; ningún clon con datos: `Ningún clon trae datos de cobertura` |
| `codeOf` | `ApiError.codeOf(caught)` estático en `web/src/api/client.ts` sustituye a los `codeOf` privados de `App.tsx` y `Heat.tsx` (la misma regla estaba escrita dos veces) |
| Tokens de marca | `web/src/tokens.css` no se toca |

## 3. Reference patterns

Files to imitate: `server/src/api/routes.ts` (router, `createCache`, `keyOf` con NUL),
`server/src/api/errors.ts` (sobre tipado), `server/src/repos.ts` (stat tolerante y `console.warn`
de lo que degrada), `server/src/api/routes.test.ts` (world sobre `tmp`, spies que llaman al real),
`server/src/testing/repo-fixture.ts` (fixtures fuera del emit), `server/src/repos.test.ts`
(`captureWarnings`), `web/src/Heat.tsx` (bloque que se carga solo: `AbortController`, `role="alert"`,
filas con `ROW_STYLE`), `web/src/heat-rows.ts` (módulo puro pineado con strings exactos),
`web/src/format.ts` (textos en español), `web/src/Heat.test.tsx` (doble de `fetch` por URL),
`web/src/App.test.tsx` (`stubApi`), `docs/design/repo-pulse-mockup.html` (tipografías y jerarquía
de los bloques).

Rules to obey: `AGENTS.md` (código en inglés, textos de UI en español, frontera `web/` ↔
`server/` sin importar tipos del server, `127.0.0.1`, nunca mutar ni ejecutar en un clon, ningún
dato de autor fuera del server, comandos de build/test/lint, sufijo `.js` en imports relativos de
`server/`, regla boy scout). Este repo no declara un fichero .agent/conventions.md ni un bloque de vara en
`AGENTS.md`. Además rige la vara de Control Tower: los cinco documentos de conventions del plugin
(defects, style, decisions, architecture, testing), que el programa pega en cada brief y que
prevalecen sobre las reglas de este repo regla a regla, no por tema; la fila «Capas del módulo
nuevo» y la fila «Estilo de los módulos nuevos» de §2 son su aplicación aquí.

## 4. Inventory

| File | Action | Consumed by | Block in §7 |
|---|---|---|---|
| `server/src/coverage/domain/coverage-source.ts` | create | dominio, infra, payload | Contract (Task 1) |
| `server/src/coverage/domain/line-count.ts` | create | parsers, ranking, payload | Contract (Task 1) |
| `server/src/coverage/domain/unusable-artifact.ts` | create | parsers, reader | Contract (Task 1) |
| `server/src/coverage/domain/coverage.ts` | create | caso de uso, ranking, payload | Contract (Task 1) |
| `server/src/coverage/domain/line-count.test.ts` | create | — | none (tests by TDD) |
| `server/src/coverage/domain/clone-catalog.ts` | create | caso de uso | Contract (Task 2) |
| `server/src/coverage/domain/artifact-candidate.ts` | create | locator, reader, preferencia | Contract (Task 2) |
| `server/src/coverage/domain/artifact-locator.ts` | create | caso de uso | Contract (Task 2) |
| `server/src/coverage/domain/artifact-reader.ts` | create | caso de uso, caché | Contract (Task 2) |
| `server/src/coverage/domain/artifact-preference.ts` | create | caso de uso | Contract (Task 3) |
| `server/src/coverage/domain/coverage-ranking.ts` | create | caso de uso, payload | Contract (Task 3) |
| `server/src/coverage/application/read-coverage-ranking.ts` | create | `app.ts`, `routes.ts` | Contract (Task 3) |
| `server/src/coverage/application/read-coverage-ranking.test.ts` | create | — | none (tests by TDD) |
| `server/src/coverage/infrastructure/coverage-parser.ts` | create | reader, parsers | Contract (Task 4) |
| `server/src/coverage/infrastructure/lcov-parser.ts` | create | `app.ts` | Contract (Task 4) |
| `server/src/coverage/infrastructure/lcov-parser.test.ts` | create | — | none (tests by TDD) |
| `server/src/coverage/infrastructure/istanbul-summary-parser.ts` | create | `app.ts` | Contract (Task 5) |
| `server/src/coverage/infrastructure/cobertura-parser.ts` | create | `app.ts` | Contract (Task 5) |
| `server/src/coverage/infrastructure/istanbul-summary-parser.test.ts` | create | — | none (tests by TDD) |
| `server/src/coverage/infrastructure/cobertura-parser.test.ts` | create | — | none (tests by TDD) |
| `server/src/coverage/infrastructure/filesystem-artifact-locator.ts` | create | `app.ts` | Contract (Task 6) |
| `server/src/coverage/infrastructure/filesystem-artifact-locator.test.ts` | create | — | none (tests by TDD) |
| `server/src/coverage/infrastructure/filesystem-artifact-reader.ts` | create | `app.ts` | Contract (Task 7) |
| `server/src/coverage/infrastructure/filesystem-artifact-reader.test.ts` | create | — | none (tests by TDD) |
| `server/src/coverage/infrastructure/cached-artifact-reader.ts` | create | `app.ts` | Contract (Task 8) |
| `server/src/coverage/infrastructure/cached-artifact-reader.test.ts` | create | — | none (tests by TDD) |
| `server/src/coverage/infrastructure/coverage-payload.ts` | create | `routes.ts` | Contract (Task 9) |
| `server/src/coverage/infrastructure/coverage-payload.test.ts` | create | — | none (tests by TDD) |
| `server/src/testing/coverage-fixtures.ts` | create | tests de server | Contract (Task 9) |
| `server/src/app.ts` | modify | `index.ts`, tests | Current state + Call site (Task 10) |
| `server/src/api/routes.ts` | modify | `app.ts` | Current state (Task 10) + Call site (Task 11) |
| `server/src/api/errors.test.ts` | modify | — | Current state (Task 10) |
| `server/src/api/routes.test.ts` | modify | — | none (world en Task 10, tests by TDD en Task 11) |
| `web/src/api/types.ts` | modify | cliente, bloque | Contract (Task 12) |
| `web/src/api/client.ts` | modify | bloque, `App.tsx`, `Heat.tsx` | Current state + Contract (Task 12) |
| `web/src/api/client.test.ts` | modify | — | none (tests by TDD) |
| `web/src/App.tsx` | modify | — | Current state (Task 12) + Call site (Task 16) |
| `web/src/Heat.tsx` | modify | `App.tsx` | Current state (Task 12) |
| `web/src/format.ts` | modify | bloque | Contract (Task 13) |
| `web/src/format.test.ts` | modify | — | none (tests by TDD) |
| `web/src/champions-rows.ts` | create | bloque | Contract (Task 14) |
| `web/src/champions-rows.test.ts` | create | — | none (tests by TDD) |
| `web/src/Champions.tsx` | create | `App.tsx` | Contract (Task 15) |
| `web/src/Champions.test.tsx` | create | — | none (tests by TDD) |
| `web/src/App.test.tsx` | modify | — | Current state (Task 16) |

## 5. Interfaces

Consumes (ya mergeado): `Catalog.list(): Promise<Clone[]>` de `server/src/repos.ts` (cada `Clone`
trae `id` y `path`, que es todo lo que el caso de uso necesita); `Cache<T>` y
`createCache<T>(limit)` de `server/src/api/routes.ts` (`remember(key, compute, belongsToKey?)`);
`ApiError` y `errorHandler` de `server/src/api/errors.ts` para el sobre `{error:{code,message}}`;
en `web/`, `request<T>(url, { signal })` de `web/src/api/client.ts` y `relativeDays(iso, now)` /
`formatDay(iso)` de `web/src/format.ts`. El issue no trae sección «Dependencias» ni «Contexto
heredado» con contenido.

Produces (para slices posteriores): el endpoint `GET /api/coverage` con el payload de §2;
de `server/src/coverage/application/read-coverage-ranking.ts`, `ReadCoverageRanking` con
`execute(): Promise<CoverageRanking>`; del dominio, `CoverageSource`, `COVERAGE_SOURCES`,
`LineCount.of(covered, total)` con `percentage()`, `Coverage`, `RepoCoverage`, `CoverageRanking.of`,
`ArtifactPreference.order`, `UnusableArtifact`; de `web/src/api/client.ts`,
`fetchCoverage(signal?) => Promise<RepoCoverage[]>` y `ApiError.codeOf(caught)`; de
`web/src/api/types.ts`, `CoverageSource` y `RepoCoverage`; de `web/src/format.ts`,
`coverageLabel`, `coverageSourceLabel`, `measuredAgo`; de `web/src/champions-rows.ts`,
`ChampionsBoard.of(coverage, selectedId, nameOf) => ChampionsView`; `Champions({ repoId, nameOf, now })`
como componente por defecto de `web/src/Champions.tsx`.

## 6. Test strategy

Vitest en los dos workspaces (`npm test -w server`, `npm test -w web`), de fuera adentro y en
este orden: primero la aplicación con los puertos doblados, luego la infraestructura contra
payloads literales, y por último la API sobre clones reales en `tmp`. El dominio se cubre por ese
camino; la única excepción es `LineCount`, que valida por sí mismo y no se alcanza de otra forma.

Los dobles del caso de uso viven en su test como clases: `InMemoryClones` (lista fija),
`InMemoryArtifactLocator` (candidatos por ruta de clon; LANZA ante un clon sin respuesta escrita)
e `InMemoryArtifactReader` (lectura por `path`; LANZA ante un path sin respuesta): así «no lee el
siguiente candidato cuando el primero vale» se comprueba porque el doble no tiene respuesta para
él. Los candidatos los construye la mother `CandidateMother` con escenarios nombrados
(`lcovAt(clone, measuredAt)`, `istanbulAt(...)`, `coberturaAt(...)`), también una clase del test.
Los artefactos literales (uno por formato, más «sin líneas» y «no es un artefacto») son constantes
de `server/src/testing/coverage-fixtures.ts`, que también escribe ficheros con mtime controlado; los
tests de parsers comparan contra ESOS literales, no contra un modelo del formato. Los tests de la
API amplían el `World` de `server/src/api/routes.test.ts` con un spy sobre el reader real.

En `web/`, `champions-rows.ts` y `format.ts` se pinean con strings exactos sin DOM; el bloque se
prueba solo (`Champions.test.tsx`) doblando `fetch` con `vi.stubGlobal` y con `now` fijado por
prop; el montaje bajo el grid se prueba desde `App`. Ningún test toca la red ni ejecuta nada en
un clon. Ningún control fija el total de tests de la suite: cada tarea corre sus propios ficheros.
Cada aserción nueva se ve fallar rompiendo a mano lo que su nombre protege antes de darla por
buena. Las tareas sin tests lo dicen con `No TDD` y su razón.

## 7. Tasks

### Task 1 — el dominio: vocabulario, líneas y cobertura

**Objective:** existen los valores del dominio de cobertura, con `LineCount` validando y
redondeando a un decimal por sí mismo.

**Files:** `server/src/coverage/domain/coverage-source.ts` (create),
`server/src/coverage/domain/line-count.ts` (create),
`server/src/coverage/domain/unusable-artifact.ts` (create),
`server/src/coverage/domain/coverage.ts` (create),
`server/src/coverage/domain/line-count.test.ts` (create)

Contract (server/src/coverage/domain/coverage-source.ts):

```ts
export const COVERAGE_SOURCES = ['lcov', 'istanbul', 'cobertura'] as const
export type CoverageSource = (typeof COVERAGE_SOURCES)[number]
```

Contract (server/src/coverage/domain/unusable-artifact.ts):

```ts
export type UnusableReason = 'unreadable' | 'oversized' | 'malformed' | 'no-lines'
export class UnusableArtifact extends Error {
  readonly reason: UnusableReason
  constructor(reason: UnusableReason, message: string)
}
```

Contract (server/src/coverage/domain/line-count.ts):

```ts
export class LineCount {
  private constructor(readonly covered: number, readonly total: number)
  static of(covered: number, total: number): LineCount
  percentage(): number
}
```

Contract (server/src/coverage/domain/coverage.ts):

```ts
export interface MeasuredCoverage { readonly kind: 'measured'; readonly source: CoverageSource; readonly lines: LineCount; readonly measuredAt: Date }
export interface MissingCoverage { readonly kind: 'missing' }
export type Coverage = MeasuredCoverage | MissingCoverage
export interface RepoCoverage { readonly id: string; readonly coverage: Coverage }
```

`LineCount.of` lanza `UnusableArtifact('no-lines', …)` con `total === 0`, y
`UnusableArtifact('malformed', …)` si alguno no es un entero ≥ 0 (`Number.isInteger`) o si
`covered > total`. `percentage()` es `Math.round((covered / total) * 1000) / 10`. El error pone
`this.name = 'UnusableArtifact'`. Ningún comentario en estos ficheros.

**TDD:** `test('the percentage is rounded to one decimal, half up')` — `LineCount.of(2, 3).percentage()`
es `66.7`, `LineCount.of(1333, 2000)` es `66.7` y `LineCount.of(1332, 2000)` es `66.6`: el par
1333/1332 pina la mitad exacta; además `LineCount.of(200, 200)` es `100` y `LineCount.of(0, 200)`
es `0`. Luego el mínimo verde.

**Tests:** añadidos: 'the percentage is rounded to one decimal, half up',
'a count with no lines is an artifact without lines' (`of(0, 0)` lanza con `reason` `'no-lines'`),
'an impossible count is malformed' (`of(3, 2)`, `of(1.5, 2)` y `of(-1, 2)` lanzan con `reason`
`'malformed'`).

**Verification:** el test del valor pasa, el dominio no importa nada de fuera y no lleva prosa.

```bash
npm test -w server -- src/coverage/domain/line-count.test.ts                                   # expected: exit 0
test "$(grep -rlE "from '(node:|express)" server/src/coverage/domain | wc -l)" -eq 0            # expected: exit 0 — el dominio no conoce a nadie
test "$(grep -rlE '^\s*(//|/\*)' server/src/coverage | wc -l)" -eq 0                            # expected: exit 0 — sin comentarios en el módulo nuevo
npm run build                                                                                   # expected: exit 0
```

### Task 2 — el dominio: los puertos

**Objective:** el caso de uso tiene nombrados sus tres puertos y el valor que cruza entre ellos.

**Files:** `server/src/coverage/domain/clone-catalog.ts` (create),
`server/src/coverage/domain/artifact-candidate.ts` (create),
`server/src/coverage/domain/artifact-locator.ts` (create),
`server/src/coverage/domain/artifact-reader.ts` (create)

Contract (server/src/coverage/domain/clone-catalog.ts):

```ts
export interface CloneRef { readonly id: string; readonly path: string }
export interface CloneCatalog { list(): Promise<readonly CloneRef[]> }
```

Contract (server/src/coverage/domain/artifact-candidate.ts):

```ts
export interface ArtifactCandidate {
  readonly source: CoverageSource
  readonly path: string
  readonly measuredAt: Date
  readonly bytes: number
}
```

Contract (server/src/coverage/domain/artifact-locator.ts):

```ts
export interface ArtifactLocator { locate(clone: string): Promise<readonly ArtifactCandidate[]> }
```

Contract (server/src/coverage/domain/artifact-reader.ts):

```ts
export type ArtifactReading =
  | { readonly kind: 'lines'; readonly lines: LineCount }
  | { readonly kind: 'unusable'; readonly reason: UnusableReason }
export interface ArtifactReader { read(candidate: ArtifactCandidate): Promise<ArtifactReading> }
```

`path` es la ruta ABSOLUTA del artefacto; `measuredAt` es su mtime y `bytes` su tamaño, ambos
del mismo `stat`. `Catalog` de `server/src/repos.ts` satisface `CloneCatalog` sin adaptador.

**TDD:** No TDD — solo interfaces y un tipo unión; no hay comportamiento que poner en rojo. Se
pinan a través del caso de uso en la Task 3.

**Tests:** N/A — la tarea no añade ni retira ningún test.

**Verification:** compila y el dominio sigue sin conocer a nadie ni llevar prosa.

```bash
npm run build                                                                                   # expected: exit 0
test "$(grep -rlE "from '(node:|express|\.\./(application|infrastructure))" server/src/coverage/domain | wc -l)" -eq 0   # expected: exit 0
test "$(grep -rlE '^\s*(//|/\*)' server/src/coverage | wc -l)" -eq 0                            # expected: exit 0
```

### Task 3 — las políticas y el caso de uso `ReadCoverageRanking`

**Objective:** con los puertos doblados, el caso de uso devuelve el ranking ordenado leyendo por
clon solo el artefacto preferido que resulte utilizable.

**Files:** `server/src/coverage/domain/artifact-preference.ts` (create),
`server/src/coverage/domain/coverage-ranking.ts` (create),
`server/src/coverage/application/read-coverage-ranking.ts` (create),
`server/src/coverage/application/read-coverage-ranking.test.ts` (create)

Contract (server/src/coverage/domain/artifact-preference.ts):

```ts
export class ArtifactPreference {
  static order(candidates: readonly ArtifactCandidate[]): ArtifactCandidate[]
}
```

Contract (server/src/coverage/domain/coverage-ranking.ts):

```ts
export class CoverageRanking {
  private constructor(readonly entries: readonly RepoCoverage[])
  static of(entries: readonly RepoCoverage[]): CoverageRanking
}
```

Contract (server/src/coverage/application/read-coverage-ranking.ts):

```ts
export interface ReadCoverageRankingDeps {
  readonly clones: CloneCatalog
  readonly locator: ArtifactLocator
  readonly reader: ArtifactReader
}
export class ReadCoverageRanking {
  constructor(deps: ReadCoverageRankingDeps)
  execute(): Promise<CoverageRanking>
}
```

`ArtifactPreference.order`: `measuredAt.getTime()` descendente, luego
`COVERAGE_SOURCES.indexOf(source)` ascendente, luego `path` ascendente (`<`). `CoverageRanking.of`
ordena como dice §2 («Orden del ranking») sin mutar la entrada. `execute()`: lista los clones,
los resuelve en paralelo (`Promise.all`) y, por clon, lee los candidatos ya ordenados uno a uno:
la primera lectura `'lines'` cierra el clon como `measured` (con `source` y `measuredAt` del
candidato); una `'unusable'` pasa al siguiente; agotados, `missing`. El `switch` sobre
`reading.kind` no lleva `default`.

**TDD:** `test('clones are ranked by percentage, highest first, and the ones without artifact go last')`
— tres clones: `beta` con lcov 199/300 (66.3), `alpha` con istanbul 2/3 (66.7) y `gamma` sin
candidatos; `execute()` devuelve los ids `['alpha', 'beta', 'gamma']` y `gamma` con
`coverage.kind === 'missing'`. Luego el mínimo verde.

**Tests:** añadidos: 'clones are ranked by percentage, highest first, and the ones without artifact go last',
'ties on the rounded percentage are broken by id' (`zeta` 85/100 y `alpha` 170/200 → `alpha` antes),
'the newest artifact is the one read when a clone has several' (lcov viejo y cobertura nuevo → `'cobertura'`),
'on the same mtime lcov wins over istanbul, and istanbul over cobertura',
'an unusable artifact does not count and the next candidate is read',
'a clone whose only artifact is unusable has no coverage',
'nothing is read past the first usable artifact' (el doble no tiene respuesta para el segundo),
'an empty root is an empty ranking'.

**Verification:** los tests del caso de uso pasan y la aplicación no importa infraestructura.

```bash
npm test -w server -- src/coverage/application/read-coverage-ranking.test.ts                    # expected: exit 0
test "$(grep -rlE "from '(node:|express|\.\./infrastructure)" server/src/coverage/application | wc -l)" -eq 0   # expected: exit 0
test "$(grep -rlE '^(export )?(async )?function ' server/src/coverage | wc -l)" -eq 0            # expected: exit 0 — ninguna función suelta a nivel de módulo
npm run build                                                                                   # expected: exit 0
```

### Task 4 — el puerto de parsers y el parser de lcov

**Objective:** un `lcov.info` se convierte en su `LineCount` sumando todos sus records, y lo que no
es lcov o no trae líneas se rechaza con su razón.

**Files:** `server/src/coverage/infrastructure/coverage-parser.ts` (create),
`server/src/coverage/infrastructure/lcov-parser.ts` (create),
`server/src/coverage/infrastructure/lcov-parser.test.ts` (create)

Contract (server/src/coverage/infrastructure/coverage-parser.ts):

```ts
export interface CoverageParser { parse(text: string): LineCount }
export type CoverageParsers = Readonly<Record<CoverageSource, CoverageParser>>
```

Contract (server/src/coverage/infrastructure/lcov-parser.ts):

```ts
export class LcovParser implements CoverageParser {
  parse(text: string): LineCount
}
```

Reglas cerradas (§2, fila «lcov»): se recorren las líneas; `LF:<n>` suma al total y `LH:<n>` a
las cubiertas, con `n` entero decimal (`/^LF:(\d+)$/`, `/^LH:(\d+)$/`); un `LF:` o `LH:` cuyo
valor no case es `UnusableArtifact('malformed', …)`; un texto sin ninguna línea `SF:` ni
`end_of_record` es `'malformed'`; lcov válido sin ningún `LF:` es `'no-lines'`. El total se
entrega a `LineCount.of`, que decide el `'no-lines'` de `LF:0`. Los fixtures literales llegan en
la Task 9; hasta entonces el test lleva sus propios literales lcov en constantes del test.

**TDD:** `test('lcov sums the lines found and hit across every record')` — un texto con dos
records (`LF:120`/`LH:100` y `LF:80`/`LH:70`) parsea a `covered` `170` y `total` `200`. Luego el
mínimo verde.

**Tests:** añadidos: 'lcov sums the lines found and hit across every record',
'an lcov whose records carry no LF is an artifact without lines' (solo `SF:`/`DA:`/`end_of_record` → `reason` `'no-lines'`),
'text that is not lcov is malformed' (`'this file is not a coverage artifact\n'` y un record con `LF:abc` → `'malformed'`).

**Verification:** el parser queda pineado contra literales.

```bash
npm test -w server -- src/coverage/infrastructure/lcov-parser.test.ts                           # expected: exit 0
test "$(grep -rlE '^(export )?(async )?function ' server/src/coverage | wc -l)" -eq 0            # expected: exit 0
npm run build                                                                                   # expected: exit 0
```

### Task 5 — los parsers de Istanbul y Cobertura

**Objective:** `coverage-summary.json` y `coverage.xml` se convierten en su `LineCount` por
proyección de las claves que se consumen, y lo demás se rechaza con su razón.

**Files:** `server/src/coverage/infrastructure/istanbul-summary-parser.ts` (create),
`server/src/coverage/infrastructure/cobertura-parser.ts` (create),
`server/src/coverage/infrastructure/istanbul-summary-parser.test.ts` (create),
`server/src/coverage/infrastructure/cobertura-parser.test.ts` (create)

Contract (server/src/coverage/infrastructure/istanbul-summary-parser.ts):

```ts
export class IstanbulSummaryParser implements CoverageParser {
  parse(text: string): LineCount
}
```

Contract (server/src/coverage/infrastructure/cobertura-parser.ts):

```ts
export class CoberturaParser implements CoverageParser {
  parse(text: string): LineCount
}
```

Istanbul (§2): `JSON.parse` fallido, raíz no objeto o sin clave `total` (objeto) → `'malformed'`;
`total` sin `lines` (objeto) → `'no-lines'`; `total.lines.total` y `total.lines.covered` se
validan como `number` con `typeof` (nunca un cast) y van a `LineCount.of`; las demás claves se
ignoran. Cobertura (§2): la primera etiqueta de apertura `/<coverage\b([^>]*)>/`; sin ella,
`'malformed'`; dentro de sus atributos, `lines-valid` y `lines-covered` con
`/\blines-valid=["'](\d+)["']/` y `/\blines-covered=["'](\d+)["']/`; falta alguno → `'no-lines'`;
los dos van a `LineCount.of` (`lines-valid` es el total). No se recorren los `<line>`.

**TDD:** `test('the summary reads the total lines of the whole run, not of a file')` — un JSON
con `total.lines` `{ total: 300, covered: 199, skipped: 0, pct: 66.33 }` y una entrada por
fichero con `lines` `{ total: 10, covered: 1 }` parsea a `covered` `199`, `total` `300`. Luego el
mínimo verde, y después el de Cobertura.

**Tests:** añadidos en el de Istanbul: 'the summary reads the total lines of the whole run, not of a file',
'a summary with no lines section is an artifact without lines',
'a summary that is not JSON, or has no total, is malformed'. En el de Cobertura:
'cobertura reads lines-covered and lines-valid off the root element' (`lines-valid="8" lines-covered="1"` → `1`/`8`, también con comillas simples),
'a cobertura root without line attributes is an artifact without lines',
'text without a coverage element is malformed'.

**Verification:** los dos parsers quedan pineados contra literales.

```bash
npm test -w server -- src/coverage/infrastructure/istanbul-summary-parser.test.ts src/coverage/infrastructure/cobertura-parser.test.ts   # expected: exit 0
test "$(grep -rl ' as ' server/src/coverage/infrastructure/istanbul-summary-parser.ts | wc -l)" -eq 0   # expected: exit 0 — sin casts en la frontera
npm run build                                                                                   # expected: exit 0
```

### Task 6 — el locator de filesystem

**Objective:** el server encuentra, sin ejecutar nada, los artefactos de un clon en sus rutas
fijas, con el mtime y el tamaño de cada uno.

**Files:** `server/src/coverage/infrastructure/filesystem-artifact-locator.ts` (create),
`server/src/coverage/infrastructure/filesystem-artifact-locator.test.ts` (create)

Contract (server/src/coverage/infrastructure/filesystem-artifact-locator.ts):

```ts
export type ArtifactPaths = Readonly<Record<CoverageSource, readonly string[]>>
export const ARTIFACT_PATHS: ArtifactPaths = {
  lcov: ['coverage/lcov.info', 'lcov.info'],
  istanbul: ['coverage/coverage-summary.json', 'coverage-summary.json'],
  cobertura: ['coverage/coverage.xml', 'coverage.xml'],
}
export class FilesystemArtifactLocator implements ArtifactLocator {
  constructor(paths: ArtifactPaths)
  locate(clone: string): Promise<readonly ArtifactCandidate[]>
}
```

Recorre `COVERAGE_SOURCES` y, por fuente, sus rutas en orden; `stat` (de `node:fs/promises`) de
`join(clone, relative)`; un `stat` que lanza o que no es `isFile()` no produce candidato; el que sí,
produce `{ source, path: join(clone, relative), measuredAt: stats.mtime, bytes: stats.size }`.
Devuelve los candidatos en orden de recorrido: el orden de preferencia lo decide
`ArtifactPreference`, no este adaptador. Sin recursión ni `readdir`.

**TDD:** `test('the locator finds each artifact at its fixed path with its mtime and size')` — en
un directorio de `tmp` se escriben `coverage/lcov.info` (mtime fijado con `utimesSync` a un
instante en segundos enteros) y `coverage.xml`; `locate` devuelve dos candidatos con `source`
`'lcov'` y `'cobertura'`, sus `path` absolutos, `measuredAt` igual al mtime fijado y `bytes`
igual a la longitud del texto escrito. Luego el mínimo verde.

**Tests:** añadidos: 'the locator finds each artifact at its fixed path with its mtime and size',
'a clone without artifacts has no candidates',
'a directory at an artifact path is not a candidate' (un directorio llamado `lcov.info`),
'an artifact under a workspace folder is not looked for' (`server/coverage/lcov.info` → ninguno).

**Verification:** el locator queda pineado y solo hace `stat`.

```bash
npm test -w server -- src/coverage/infrastructure/filesystem-artifact-locator.test.ts           # expected: exit 0
test "$(grep -rlE 'readdir|child_process|execFile|spawn\(' server/src/coverage | wc -l)" -eq 0  # expected: exit 0 — ni recursión ni procesos
npm run build                                                                                   # expected: exit 0
```

### Task 7 — el reader de filesystem

**Objective:** un candidato se lee del disco y se parsea con el parser de su formato, con tope de
tamaño, y todo rechazo vuelve como lectura `unusable` con su razón y un aviso.

**Files:** `server/src/coverage/infrastructure/filesystem-artifact-reader.ts` (create),
`server/src/coverage/infrastructure/filesystem-artifact-reader.test.ts` (create)

Contract (server/src/coverage/infrastructure/filesystem-artifact-reader.ts):

```ts
export class FilesystemArtifactReader implements ArtifactReader {
  constructor(parsers: CoverageParsers, maxBytes: number)
  read(candidate: ArtifactCandidate): Promise<ArtifactReading>
}
```

`read`: si `candidate.bytes > maxBytes`, `'oversized'` sin tocar el disco; si `readFile(path, 'utf8')`
lanza, `'unreadable'`; el texto va a `this.parsers[candidate.source].parse(text)` y su `LineCount`
vuelve como `{ kind: 'lines', lines }`; un `UnusableArtifact` lanzado por el parser vuelve como
`{ kind: 'unusable', reason: error.reason }`; cualquier otro error se propaga. Toda lectura
`unusable` emite antes `console.warn(\`repo-pulse: ignoring ${candidate.path}: ${reason}\`)`.
`maxBytes` no tiene valor por defecto: lo decide quien compone (Task 10).

**TDD:** `test('the reader hands the text to the parser of the candidate source and returns its lines')`
— un `coverage.xml` con `lines-valid="8" lines-covered="1"` escrito en `tmp`, un candidato
`source: 'cobertura'` con sus `bytes` reales y parsers reales devuelve `{ kind: 'lines' }` con
`covered` `1` y `total` `8`; un doble de parser para `lcov` que lanza si se le llama prueba que
solo se usó el de Cobertura. Luego el mínimo verde.

**Tests:** añadidos: 'the reader hands the text to the parser of the candidate source and returns its lines',
'a parser rejection is an unusable reading with its reason and a warning' (texto no lcov como `lcov` → `'malformed'`, `console.warn` una vez con el `path`),
'an artifact over the cap is unusable without being read' (`maxBytes` menor que `bytes` → `'oversized'`, parser no llamado),
'an artifact that vanished after being located is unreadable' (`path` inexistente → `'unreadable'`).

**Verification:** el reader queda pineado; la suite no imprime avisos porque los captura.

```bash
npm test -w server -- src/coverage/infrastructure/filesystem-artifact-reader.test.ts            # expected: exit 0
test "$(grep -rlE 'child_process|execFile|spawn\(' server/src/coverage | wc -l)" -eq 0          # expected: exit 0
npm run build                                                                                   # expected: exit 0
```

### Task 8 — la caché por ruta y mtime

**Objective:** un artefacto que no ha cambiado no se vuelve a leer ni a parsear entre peticiones.

**Files:** `server/src/coverage/infrastructure/cached-artifact-reader.ts` (create),
`server/src/coverage/infrastructure/cached-artifact-reader.test.ts` (create)

Contract (server/src/coverage/infrastructure/cached-artifact-reader.ts):

```ts
export class CachedArtifactReader implements ArtifactReader {
  constructor(inner: ArtifactReader, cache: Cache<ArtifactReading>)
  read(candidate: ArtifactCandidate): Promise<ArtifactReading>
}
```

`Cache` es el `import type { Cache } from '../../api/routes.js'` (solo tipo: el valor
`createCache` lo pasa quien compone). La clave es
`` `${candidate.path} ${candidate.measuredAt.getTime()}` `` y `read` es
`cache.remember(key, () => inner.read(candidate))`: se cachean igual las lecturas `'lines'` y las
`'unusable'`, porque un artefacto corrupto tampoco cambia hasta que cambia su mtime.

**TDD:** `test('the same path and mtime is read once; a newer mtime is read again')` — con un
doble de `ArtifactReader` que cuenta llamadas y un `createCache<ArtifactReading>(8)` real, dos
`read` del mismo candidato llaman al interno UNA vez y devuelven la misma lectura; el mismo `path`
con `measuredAt` un segundo mayor lo llama de nuevo. Luego el mínimo verde.

**Tests:** añadidos: 'the same path and mtime is read once; a newer mtime is read again',
'two artifacts at different paths do not share an entry',
'an unusable reading is cached like a measured one'.

**Verification:** la caché queda pineada por su efecto (llamadas al interno), no por su clave.

```bash
npm test -w server -- src/coverage/infrastructure/cached-artifact-reader.test.ts                # expected: exit 0
test "$(grep -rlE '^(export )?(async )?function ' server/src/coverage | wc -l)" -eq 0            # expected: exit 0
npm run build                                                                                   # expected: exit 0
```

### Task 9 — el payload del wire y los fixtures literales

**Objective:** el ranking del dominio se serializa a la forma exacta que fija el issue, y los
tests del server tienen un artefacto literal por formato más los dos casos que no cuentan.

**Files:** `server/src/coverage/infrastructure/coverage-payload.ts` (create),
`server/src/coverage/infrastructure/coverage-payload.test.ts` (create),
`server/src/testing/coverage-fixtures.ts` (create)

Contract (server/src/coverage/infrastructure/coverage-payload.ts):

```ts
export interface RepoCoveragePayload {
  readonly id: string
  readonly percentage: number | null
  readonly lines: { readonly covered: number; readonly total: number } | null
  readonly source: CoverageSource | null
  readonly measuredAt: string | null
}
export interface CoverageRankingPayload { readonly repos: readonly RepoCoveragePayload[] }
export class CoveragePayload {
  static of(ranking: CoverageRanking): CoverageRankingPayload
}
```

Contract (server/src/testing/coverage-fixtures.ts):

```ts
export class CoverageFixtures {
  static readonly LCOV: string
  static readonly ISTANBUL_SUMMARY: string
  static readonly COBERTURA: string
  static readonly LCOV_WITHOUT_LINES: string
  static readonly NOT_AN_ARTIFACT: string
  static write(clone: string, relativePath: string, text: string, measuredAt?: Date): string
}
```

`CoveragePayload.of` hace un `switch` sin `default` sobre `coverage.kind`: `measured` →
`{ id, percentage: lines.percentage(), lines: { covered, total }, source, measuredAt: measuredAt.toISOString() }`;
`missing` → `{ id, percentage: null, lines: null, source: null, measuredAt: null }`, claves en
ESE orden. Los literales: `LCOV` dos records `LF:120`/`LH:100` y `LF:80`/`LH:70` (170/200 → 85);
`ISTANBUL_SUMMARY` con `total.lines` `{ total: 300, covered: 199 }` más una entrada de fichero
(66.3); `COBERTURA` un `<coverage line-rate="0.125" lines-valid="8" lines-covered="1" …>` con un
`<packages>` mínimo (12.5); `LCOV_WITHOUT_LINES` un record con `SF:`, dos `DA:` y `end_of_record`
sin `LF:`/`LH:`; `NOT_AN_ARTIFACT` es `'this file is not a coverage artifact\n'`. `write` crea los
directorios, escribe el texto, aplica `utimesSync(path, measuredAt, measuredAt)` si llega, y
devuelve la ruta absoluta.

**TDD:** `test('a measured clone serialises its four fields and a missing one serialises four nulls')`
— `CoveragePayload.of(CoverageRanking.of([alpha medido lcov 170/200 a 2026-06-05T00:00:00.000Z, beta missing]))`
pasa por `JSON.parse(JSON.stringify(…))` y es exactamente
`{ repos: [{ id: 'alpha', percentage: 85, lines: { covered: 170, total: 200 }, source: 'lcov', measuredAt: '2026-06-05T00:00:00.000Z' }, { id: 'beta', percentage: null, lines: null, source: null, measuredAt: null }] }`,
y `Object.keys` de cada entry es `['id', 'percentage', 'lines', 'source', 'measuredAt']`. Luego el
mínimo verde.

**Tests:** añadidos: 'a measured clone serialises its four fields and a missing one serialises four nulls'.

**Verification:** el payload queda pineado literalmente y los fixtures quedan fuera del emit.

```bash
npm test -w server -- src/coverage/infrastructure/coverage-payload.test.ts                      # expected: exit 0
npm run build                                                                                   # expected: exit 0
test ! -e server/dist/testing/coverage-fixtures.js                                              # expected: exit 0 — src/testing sigue fuera del emit
```

### Task 10 — la composición: `AppDeps.coverage` y el grafo en `createDeps`

**Objective:** la raíz de composición monta el caso de uso de cobertura con sus adaptadores
reales y lo ofrece a la API como un puerto más de `AppDeps`.

**Files:** `server/src/app.ts` (modify), `server/src/api/routes.ts` (modify),
`server/src/api/errors.test.ts` (modify), `server/src/api/routes.test.ts` (modify)

Current state (server/src/app.ts, lines 25-31):

```ts
export interface AppDeps {
  catalog: Catalog
  settings: SettingsStore
  analysis: AnalysisPort
  /** Reference instant of every window and of the freshness check. */
  now(): Date
}
```

Current state (server/src/api/routes.ts, lines 26-26):

```ts
const CACHE_LIMIT = 64
```

Current state (server/src/api/errors.test.ts, lines 26-27):

```ts
    analysis: { readHeadSha: fail, readLastCommitAt: fail, walkHistory: fail, heatTree: fail },
    now: () => new Date(),
```

Call site (server/src/app.ts):

```ts
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024
// en createDeps, con `catalog` en una constante local:
const parsers: CoverageParsers = { lcov: new LcovParser(), istanbul: new IstanbulSummaryParser(), cobertura: new CoberturaParser() }
coverage: new ReadCoverageRanking({
  clones: catalog,
  locator: new FilesystemArtifactLocator(ARTIFACT_PATHS),
  reader: new CachedArtifactReader(new FilesystemArtifactReader(parsers, MAX_ARTIFACT_BYTES), createCache(CACHE_LIMIT)),
}),
```

`AppDeps` gana `coverage: Pick<ReadCoverageRanking, 'execute'>` entre `analysis` y `now`, y
`CACHE_LIMIT` pasa a `export const` para que `app.ts` lo importe junto a `createCache`.
`appOver` de `errors.test.ts` añade `coverage: { execute: fail }` entre `analysis` y `now`. El
`World` de `routes.test.ts` gana `artifactReads: Mock<ArtifactReader['read']>` (un `vi.fn` que
llama a un `FilesystemArtifactReader` real con los tres parsers y `1024 * 1024` de tope) y
`depsOverTheSameFiles` compone `coverage` como `createDeps` pero con
`reader: new CachedArtifactReader({ read: artifactReads }, createCache(CACHE_LIMIT))`. La ruta que
consume `deps.coverage` llega en la Task 11.

**TDD:** No TDD — la composición no tiene comportamiento observable hasta que exista la ruta
(Task 11); los stubs de los dos tests entran para que el tipo compile, sin aserción nueva.

**Tests:** N/A — la tarea no añade ni retira ningún test.

**Verification:** compila con el puerto nuevo y los tests existentes siguen en verde.

```bash
npm run build                                                                                   # expected: exit 0 — el typecheck cubre los dos tests con AppDeps nuevo
npm test -w server -- src/api/errors.test.ts src/api/routes.test.ts                             # expected: exit 0
test "$(grep -c 'MAX_ARTIFACT_BYTES' server/src/app.ts)" -eq 2                                  # expected: exit 0 — declarado y usado una vez
```

### Task 11 — `GET /api/coverage` y los tests de la API

**Objective:** el server responde `GET /api/coverage` con el ranking de todos los clones del root,
en el sobre de siempre y sin parsear dos veces un artefacto que no ha cambiado.

**Files:** `server/src/api/routes.ts` (modify), `server/src/api/routes.test.ts` (modify),
`server/src/api/errors.test.ts` (modify)

Call site (server/src/api/routes.ts):

```ts
  router.get('/coverage', async (_request, response) => {
    response.json(CoveragePayload.of(await deps.coverage.execute()))
  })
```

Va antes del `return router`, con `CoveragePayload` importado de
`../coverage/infrastructure/coverage-payload.js`. Los tests usan el `World` que la Task 10 dejó
compuesto (`artifactReads` es el spy sobre el reader real) y los literales de `CoverageFixtures`.

**TDD:** `test('coverage ranks every clone, highest first, with the ones without artifact last')`
— clones `alpha` (`CoverageFixtures.LCOV` en `coverage/lcov.info`, mtime `2026-06-05T00:00:00Z`),
`beta` (`COBERTURA` en `coverage.xml`), `gamma` (`ISTANBUL_SUMMARY` en `coverage/coverage-summary.json`)
y `empty` sin nada; `GET /api/coverage` es 200, los ids van `['alpha', 'gamma', 'beta', 'empty']`,
`alpha` es `{ percentage: 85, lines: { covered: 170, total: 200 }, source: 'lcov', measuredAt: '2026-06-05T00:00:00.000Z' }`,
`empty` trae los cuatro `null`, y `Object.keys` de cada entry es
`['id', 'percentage', 'lines', 'source', 'measuredAt']`. Luego el mínimo verde.

**Tests:** añadidos en `routes.test.ts`: 'coverage ranks every clone, highest first, with the ones without artifact last',
'a corrupt artifact and one without lines read as no coverage' (`NOT_AN_ARTIFACT` y `LCOV_WITHOUT_LINES` → cuatro `null` cada uno),
'an unchanged artifact is not parsed twice; a rewritten one is' (dos GET → `artifactReads` una vez para ese clon; reescrito con mtime mayor → dos);
ampliado: 'no author identity in the payload' añade `request(app).get('/api/coverage')` a su lista.
Añadido en `errors.test.ts`: 'a failing coverage ranking comes back inside the envelope' (500 con `code` `'internal'`).

**Verification:** la API queda pineada de punta a punta sobre clones de `tmp`.

```bash
npm test -w server -- src/api/routes.test.ts src/api/errors.test.ts                             # expected: exit 0
test "$(grep -c "router.get('/coverage'" server/src/api/routes.ts)" -eq 1                       # expected: exit 0 — una ruta nueva y solo una
npm run build                                                                                   # expected: exit 0
npm run lint                                                                                    # expected: exit 0
```

### Task 12 — `web/`: el tipo, el cliente y `ApiError.codeOf`

**Objective:** `web/` sabe pedir el ranking de cobertura, y la regla «lo que no es `ApiError` es
`internal`» está escrita una sola vez.

**Files:** `web/src/api/types.ts` (modify), `web/src/api/client.ts` (modify),
`web/src/api/client.test.ts` (modify), `web/src/App.tsx` (modify), `web/src/Heat.tsx` (modify)

Current state (web/src/api/client.ts, lines 8-9):

```ts
export class ApiError extends Error {
  readonly code: ApiErrorCode
```

Current state (web/src/App.tsx, lines 120-123):

```ts
/** Anything that is not an `ApiError` never reached the envelope: `internal`. */
function codeOf(caught: unknown): ApiErrorCode {
  return caught instanceof ApiError ? caught.code : 'internal'
}
```

Contract (web/src/api/types.ts):

```ts
export type CoverageSource = 'lcov' | 'istanbul' | 'cobertura'
export interface RepoCoverage {
  id: string
  percentage: number | null
  lines: { covered: number; total: number } | null
  source: CoverageSource | null
  measuredAt: string | null
}
```

Contract (web/src/api/client.ts):

```ts
export async function fetchCoverage(signal?: AbortSignal): Promise<RepoCoverage[]>
// dentro de ApiError:
static codeOf(caught: unknown): ApiErrorCode
```

`fetchCoverage` hace `request<{ repos: RepoCoverage[] }>('/api/coverage', { signal })` y devuelve
`body.repos`. `ApiError.codeOf` devuelve `caught.code` si `caught instanceof ApiError` y
`'internal'` si no. El bloque de `App.tsx` citado arriba y su gemelo de `web/src/Heat.tsx`
(líneas 278-281, mismo texto) se borran, y sus tres llamadas pasan a `ApiError.codeOf(caught)`.
En `types.ts`, los cuatro campos de medida de `RepoCoverage` son todos `null` a la vez o ninguno:
el server lo garantiza y `champions-rows.ts` (Task 14) lo lee así.

**TDD:** `test('asks for the coverage of every clone and unwraps the list')` — con `fetch` doblado
para responder `{ repos: [uno] }`, `fetchCoverage()` llama a `fetch` con `'/api/coverage'` y
resuelve exactamente ese array. Luego el mínimo verde.

**Tests:** añadidos: 'asks for the coverage of every clone and unwraps the list',
'anything that is not an ApiError reads as internal' (`ApiError.codeOf(new ApiError('unknown-repo', 'x'))` es `'unknown-repo'` y `ApiError.codeOf(new Error('boom'))` es `'internal'`).

**Verification:** el cliente queda pineado y el `codeOf` suelto ha desaparecido de los bloques.

```bash
npm test -w web -- src/api/client.test.ts                                                       # expected: exit 0
test "$(grep -rl '^function codeOf' web/src | wc -l)" -eq 0                                    # expected: exit 0 — la regla vive solo en ApiError
test "$(grep -rlE "from '(\.\./)+server/" web/src | wc -l)" -eq 0                               # expected: exit 0 — web/ no importa de server/
npm run build                                                                                   # expected: exit 0
```

### Task 13 — los textos de Campeones

**Objective:** todo el español nuevo del bloque vive en `web/src/format.ts`, puro y pineado.

**Files:** `web/src/format.ts` (modify), `web/src/format.test.ts` (modify)

Contract (web/src/format.ts):

```ts
export function coverageLabel(percentage: number): string
export function coverageSourceLabel(source: CoverageSource): string
export function measuredAgo(measuredAt: string, now: Date): string
```

`coverageLabel`: `` `${coverageFormatter.format(percentage)}%` `` con un
`new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })` a nivel
de módulo, como los `Intl.DateTimeFormat` que ya hay. `coverageSourceLabel`: `switch` exhaustivo
sin `default`, `'lcov'` → `'lcov'`, `'istanbul'` → `'Istanbul'`, `'cobertura'` → `'Cobertura'`.
`measuredAgo`: `` `medida ${relativeDays(measuredAt, now)} · ${formatDay(measuredAt)}` ``.

**TDD:** `test('the coverage label keeps one decimal with a Spanish comma')` — `coverageLabel(85.3)`
es `'85,3%'`, `coverageLabel(100)` es `'100,0%'` y `coverageLabel(0)` es `'0,0%'`: el `100`
pina que el decimal no se pierde cuando el número no lo trae. Luego el mínimo verde.

**Tests:** añadidos: 'the coverage label keeps one decimal with a Spanish comma',
'the source label names the format that was read',
'the measurement age says how long ago and on which day' (`measuredAgo('2026-06-05T00:00:00Z', new Date('2026-09-03T12:00:00Z'))` es `'medida hace 90 días · 5 jun 2026'`).

**Verification:** los textos quedan pineados.

```bash
npm test -w web -- src/format.test.ts                                                           # expected: exit 0
npm run lint                                                                                    # expected: exit 0
```

### Task 14 — `champions-rows.ts`: del wire a las filas

**Objective:** la lectura del payload (medido o sin datos, tablero vacío o con ranking, fila
seleccionada, nombre a pintar) es un módulo puro pineable sin DOM.

**Files:** `web/src/champions-rows.ts` (create), `web/src/champions-rows.test.ts` (create)

Contract (web/src/champions-rows.ts):

```ts
import type { CoverageSource, RepoCoverage } from './api/types'

export interface MeasuredRow {
  kind: 'measured'; id: string; name: string; selected: boolean
  percentage: number; source: CoverageSource; measuredAt: string
}
export interface MissingRow { kind: 'missing'; id: string; name: string; selected: boolean }
export type ChampionRow = MeasuredRow | MissingRow
export type ChampionsView = { kind: 'empty' } | { kind: 'ranked'; rows: readonly ChampionRow[] }
export class ChampionsBoard {
  static of(coverage: readonly RepoCoverage[], selectedId: string, nameOf: (id: string) => string): ChampionsView
}
```

Reglas cerradas: una entry es `measured` cuando `percentage`, `lines`, `source` y `measuredAt` son
todos distintos de `null`, y `missing` en cualquier otro caso; `name` es `nameOf(id)`; `selected`
es `id === selectedId`; la vista es `empty` cuando NINGUNA entry es `measured` (también con cero
entries) y `ranked` en el resto, con las filas en el orden en que llegan (el server ya ordena).
Sin comentarios; sin funciones sueltas a nivel de módulo.

**TDD:** `test('a board where no clone has a measurement is empty, even with clones listed')` —
`ChampionsBoard.of([], 'alpha', id => id)` es `{ kind: 'empty' }`, con dos entries todo `null`
sigue siendo `empty`, y con una medida y una `null` es `ranked` con DOS filas (`measured` y
`missing`): la frontera es una sola medida. Luego el mínimo verde.

**Tests:** añadidos: 'a board where no clone has a measurement is empty, even with clones listed',
'a clone with a measurement is a measured row and one with nulls is missing',
'the selected clone is the only row marked selected, by id',
'rows are named by the clone name the shell knows'.

**Verification:** el módulo es puro y sin funciones sueltas.

```bash
npm test -w web -- src/champions-rows.test.ts                                                   # expected: exit 0
test "$(grep -cE "from 'react'|fetch\(|^(export )?function " web/src/champions-rows.ts)" -eq 0   # expected: exit 0 — puro y colgado de un tipo
npm run build                                                                                   # expected: exit 0
```

### Task 15 — el bloque Campeones

**Objective:** el ranking de clones por cobertura se ve con nombre, barra, porcentaje, formato y
antigüedad; el seleccionado va resaltado y los estados no felices se dicen.

**Files:** `web/src/Champions.tsx` (create), `web/src/Champions.test.tsx` (create)

Contract (web/src/Champions.tsx):

```tsx
export interface ChampionsProps { repoId: string; nameOf: (id: string) => string; now: Date }
export default function Champions({ repoId, nameOf, now }: ChampionsProps)
```

Estado: `coverage: RepoCoverage[] | null` y `error: ApiErrorCode | null`; un `useEffect` con deps
`[]` y `AbortController` como `web/src/Heat.tsx`, que llama a `fetchCoverage(signal)` y guarda
`ApiError.codeOf(caught)` si falla. La vista es `ChampionsBoard.of(coverage, repoId, nameOf)`.

Composición, con las tipografías del Calor: `<section>` con cabecera `Campeones` (30px/600),
subtítulo `¿qué repos están mejor cubiertos?` (17px, `--color-neutral-600`) y a la derecha
`cobertura de líneas · leída de los artefactos de cada clon`. Error:
`<p role="alert">No se ha podido cargar la cobertura ({error}).</p>`. Vista `empty`: titular
`Ningún clon trae datos de cobertura` (26px/600) y debajo `COVERAGE_NOTE`, constante de módulo:
`Se lee, nunca se ejecuta: lcov.info, coverage-summary.json o coverage.xml que ya existan en el clon.`
Vista `ranked`: un `<div data-testid="champion-row">` por fila con el `ROW_STYLE` del Calor, más
`aria-current="true"` y `background: var(--color-surface)` si `selected`; el nombre (`row.name`,
`flex: 1`); si `measured`: `<span data-testid="coverage-bar">` absoluto abajo, 3px de alto,
`width` = `${percentage}%`, fondo `var(--color-accent)`, y luego `coverageLabel(percentage)`
(20px/600, tabular), `coverageSourceLabel(source)` y `measuredAgo(measuredAt, now)` en
`--color-neutral-600`; si `missing`: solo `Sin datos de cobertura` en `--color-neutral-600`. Pie:
`COVERAGE_NOTE`. Sin comentarios; a nivel de módulo solo el componente, `ROW_STYLE` y `COVERAGE_NOTE`.

**TDD:** `test('the ranking lists every clone with its percentage, source and age, and says which ones have no data')`
— `fetch` doblado responde `alpha` 85 lcov `2026-06-05T00:00:00.000Z`, `beta` 12.5 cobertura y
`empty` todo `null`; con `now` `2026-09-03T12:00:00Z` las filas van en ese orden, la de `alpha`
contiene `85,0%`, `lcov` y `medida hace 90 días · 5 jun 2026`, y la de `empty` contiene
`Sin datos de cobertura` y no tiene `coverage-bar`. Luego el mínimo verde.

**Tests:** añadidos: 'the ranking lists every clone with its percentage, source and age, and says which ones have no data',
'the bar of a clone is as wide as its percentage' (`style.width` de la de `beta` es `'12.5%'`),
'the selected clone is the highlighted row' (solo la fila de `repoId` lleva `aria-current`),
'when no clone has data the block says so instead of drawing rows',
'a failed load reports its code' (sobre `internal` con `ok: false` → el alert lo contiene).

**Verification:** los cuatro estados del bloque quedan pineados.

```bash
npm test -w web -- src/Champions.test.tsx   # expected: exit 0
test "$(grep -cE '^\s*(//|/\*)' web/src/Champions.tsx)" -eq 0   # expected: exit 0 — sin prosa
npm run build   # expected: exit 0
npm run lint   # expected: exit 0
```

### Task 16 — Campeones en el dashboard

**Objective:** el bloque cuelga del dashboard bajo los otros tres y resalta el clon que la
cabecera tiene seleccionado.

**Files:** `web/src/App.tsx` (modify), `web/src/App.test.tsx` (modify)

Current state (web/src/App.test.tsx, lines 97-102):

```ts
    const body =
      url === '/api/repos'
        ? { repos: CLONES }
        : url.includes('/heat?')
          ? heatFor(url)
          : summaryWith(meta, typeof overrides === 'function' ? overrides(windowOf(url)) : overrides)
```

Call site (web/src/App.tsx):

```tsx
      )}
      <Champions repoId={repoId} nameOf={(id) => repoNameOf(repos, id)} now={now} />
    </main>
```

`<Champions>` es el último hijo de `<main>`, FUERA del `summary !== null && (…)`: se monta una
vez con el shell y no se remonta al cambiar de repo ni de ventana. `stubApi` gana un tercer
parámetro `coverage: RepoCoverage[] = []` y una rama `url === '/api/coverage' ? { repos: coverage } : …`
antes de las existentes, para que los once tests actuales sigan recibiendo un ranking vacío.

**TDD:** `test('the champions block hangs below the grid and highlights the selected clone')` —
`stubApi` con una cobertura de `alpha` medida y otra de `zeta` medida; la fila con `aria-current`
es la que dice `alpha-clone` (el NOMBRE del clon, no su id), y ninguna fila está dentro del grid
de dos columnas (el elemento padre del `section` que contiene `trend-headline` no contiene las
filas). Luego el mínimo verde.

**Tests:** añadidos en `App.test.tsx`: 'the champions block hangs below the grid and highlights the selected clone'.

**Verification:** el montaje queda pineado y la suite entera de `web/` sigue en verde.

```bash
npm test -w web                                                                                 # expected: exit 0
npm run build                                                                                   # expected: exit 0
npm run lint                                                                                    # expected: exit 0
```

## 8. Global verification

Con las dieciséis tareas commiteadas, desde la raíz del worktree:

```bash
npm run build                                                                                   # expected: exit 0 — typecheck de server/ y web/ + vite build
npm test                                                                                        # expected: exit 0 — Vitest de los dos workspaces
npm run lint                                                                                    # expected: exit 0
test -z "$(git status --porcelain)"                                                             # expected: exit 0 — nada sin commitear
test "$(git diff main --stat -- web/src/tokens.css server/src/analysis | wc -l)" -eq 0          # expected: exit 0 — ni tokens ni análisis tocados
test "$(grep -rlE 'child_process|execFile|spawn\(|fetch\(' server/src/coverage | wc -l)" -eq 0  # expected: exit 0 — la cobertura se lee, nunca se ejecuta ni se pide fuera
test "$(grep -rlE "from '(\.\./)+server/" web/src | wc -l)" -eq 0                               # expected: exit 0 — web/ no importa de server/
test "$(grep -rlE '^\s*(//|/\*)' server/src/coverage web/src/champions-rows.ts web/src/Champions.tsx | wc -l)" -eq 0   # expected: exit 0 — módulos nuevos sin prosa
```

Y a mano, para el gate humano `visual`: `npm run dev -w web` con el server arrancado
(`npm run build -w server && npm start -w server`) sobre un `REPO_PULSE_ROOT` con al menos un
clon que tenga `coverage/lcov.info` y otro sin nada; abrir `http://127.0.0.1:5173`, y capturar el
antes (`main`) y el después (`feat/38`) del dashboard con el bloque Campeones y el clon
seleccionado resaltado. Ese gate NO lo cierra el agente.

## 9. Assumptions

1. **JaCoCo queda fuera de la lista final.** El issue lo declara «deseable pero no bloquea» y
   pide que el plan cierre la lista; el vocabulario `COVERAGE_SOURCES` y un parser más son el
   punto de extensión. Provenencia: issue («El plan cierra la lista final»).
2. **La ruta es `GET /api/coverage` con `{ repos: [...] }`.** Es un recurso transversal a todos
   los clones, así que no cuelga de `/repos/:id`; la envoltura `{ repos }` es la de `GET /repos`.
   Provenencia: propia, sobre `server/src/api/routes.ts`.
3. **Las rutas de artefactos son fijas y sin recursión.** Un artefacto bajo un workspace
   (`server/coverage/lcov.info`) no se busca: el server «solo lee» y una búsqueda recursiva en
   decenas de clones convertiría la petición en un recorrido de árboles. Provenencia: contexto
   del epic («leer, nunca ejecutar») + AGENTS.md («sin recursión» para el root).
4. **Gana el artefacto más reciente, no un formato fijo.** «Una cobertura de hace tres meses no
   puede parecer de hoy»: si el clon trae dos medidas, la más nueva es la que vale, y el orden de
   formatos solo desempata. Provenencia: contexto del epic.
5. **Un artefacto corrupto o sin líneas se salta y se avisa por `console.warn`; no es un error de
   la API.** «Ese artefacto no cuenta» significa pasar al siguiente candidato, y un fichero roto
   en un clon no puede tumbar el ranking de todos, como un clon roto no tumba `GET /repos`.
   Provenencia: issue + `server/src/repos.ts`.
6. **Las lecturas `unusable` también se cachean.** El patrón de `routes.ts` no cachea rechazos
   porque son promesas rechazadas; aquí el rechazo es un valor del vocabulario, y un lcov grande
   y corrupto no cambia hasta que cambia su mtime. Provenencia: propia.
7. **El `ArtifactReader` devuelve un vocabulario, no lanza.** El parser (frontera) lanza
   `UnusableArtifact`; el adaptador lo traduce a `{ kind: 'unusable', reason }` para que el caso
   de uso despache exhaustivamente en vez de capturar excepciones de control. Provenencia: vara
   de Control Tower (defects: el vocabulario cerrado viaja en la respuesta; architecture: la
   frontera lanza y no deja salir su error de validación).
8. **El tope de 64 MiB entra por constructor desde `createDeps`.** Es el mismo tope que
   `server/src/analysis/git.ts` aplica a la salida de git; el adaptador no lo elige.
   Provenencia: vara de Control Tower (architecture) + `git.ts`.
9. **El wire lleva cuatro campos `null` a la vez.** Es la forma que el issue fija; el dominio del
   server la hace irrepresentable (`Coverage` es una unión) y `web/src/champions-rows.ts` la lee
   como unión antes de pintar nada. Provenencia: issue (forma del payload).
10. **El bloque va a ancho completo bajo el grid y carga una vez.** No depende de la ventana ni
    del clon seleccionado (solo lo resalta), así que meterlo en el grid condicionado al summary
    lo remontaría y recargaría a cada cambio. Provenencia: propia, sobre `web/src/App.tsx`.
11. **La fila pinta el nombre del clon vía `nameOf`, no el `id` del payload.** El shell ya
    distingue id de nombre a propósito (`web/src/App.test.tsx`), y el issue no pide `name` en el
    payload. Provenencia: `web/src/App.tsx` (`repoNameOf`) + issue.
12. **Los componentes React siguen siendo `export default function`.** La regla «toda función
    cuelga de un tipo» cede ante el contrato del framework (hooks); el resto del código web nuevo
    (`champions-rows.ts`) sí cuelga de un tipo. Provenencia: propia, sobre los bloques existentes.
13. **`ApiError.codeOf` sustituye a dos copias.** La regla «lo que no es `ApiError` es
    `internal`» estaba en `App.tsx` y `Heat.tsx`; una tercera copia sería la misma decisión en
    tres sitios. Provenencia: vara de Control Tower (decisions).
14. **`AGENTS.md` no trae bloque de vara ni existe `.agent/conventions.md`.** La única vara del
    repo es `AGENTS.md`; sobre ella rige, regla a regla, la de Control Tower. Provenencia: lectura
    del repo.
15. **La sección «Contexto heredado» del issue está vacía y no hay «Dependencias».** No hay nada
    que heredar más allá del código mergeado; no se ha buscado fuera del issue.
