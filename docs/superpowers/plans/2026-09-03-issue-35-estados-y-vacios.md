# #35 — los estados y los vacíos de las vistas: carga, ventana sin actividad, no-repo, sin commits y foto desactualizada

> **This plan is written to be executed by task-scoped subagents that arrive with zero context
> and decide nothing.** Every task carries the current state of what it touches (copied
> verbatim), the contracts it honours and the exact commands that verify it; its bodies are
> yours to write, test-first. Names, signatures, constants and test names come from this
> document, which decided them. On ambiguity, the issue body and AGENTS.md win.

## 1. Context and goal

Hoy el shell `web/src/App.tsx` decide qué pinta con dos piezas de estado que tienen que estar
de acuerdo — `summary: Summary | null` y `error: ApiErrorCode | null` — y una cadena de
condicionales sobre las dos: si hay error pinta un párrafo con el código, si no hay ni error ni
summary pinta el texto `Cargando…`, y si hay summary pinta la rejilla de bloques (`Pulse`,
`People`, `TrendPanel`, `Heat`). De los cinco estados que la maqueta
`docs/design/repo-pulse-mockup.html` dibuja para estas mismas vistas solo existe uno: el normal.
Faltan la carga indeterminada, la ventana sin actividad con su llamada a la acción, la carpeta
que no es un repositorio git, el repositorio sin commits y el aviso de foto local
desactualizada. El aviso de frescura que sí existe vive en `web/src/Header.tsx`, derivado del
par `fetchedAt: string | null` + `stale: boolean` de `SummaryMeta`.

El slice cierra ese hueco: convierte "qué pantalla toca" en un vocabulario cerrado, decidido en
un módulo puro nuevo, y despacha sobre él de forma exhaustiva. La aritmética y los textos siguen
donde ya están: el castellano en `web/src/format.ts`, el umbral de siete días de frescura en el
servidor, que ya lo declara y ya lo tiene pinchado.

### Desired end state

- Mientras el resumen del clon seleccionado no ha llegado, la pantalla dice `Analizando <repo>…`
  con una barra de progreso indeterminada — sin lista de pasos.
- Una ventana con 0 commits enseña `0 commits en <ventana larga>`, la frase que explica que es
  una respuesta y no un fallo, y un botón `Ver 12 meses`; en la ventana de 12 meses el botón no
  aparece porque no llevaría a ninguna parte.
- Una carpeta sin `.git` enseña `Esa carpeta no es un repositorio git`, la frase que nombra la
  carpeta y la lista de clones detectados, cada uno seleccionable.
- Un clon con historial vacío enseña `Repositorio sin commits`, su frase y el pie
  `Cuando entre el primer commit, esta pantalla se llena sola.`, y la cabecera dice
  `sin historial · ningún commit todavía` en lugar de una fecha de último commit.
- Un clon cuyo `FETCH_HEAD` tiene más de siete días enseña el banner de foto desactualizada.
- Un clon sin `FETCH_HEAD` no enseña ni fecha de traída ni banner.
- `web/src/App.tsx` guarda una sola pieza de estado por carga, despacha sobre el vocabulario sin
  rama por defecto, y ya no deriva ninguna pantalla de una pareja de campos que tienen que estar
  de acuerdo.

### Out of scope

De la sección "Out of scope / Protected" del issue: sin botón `Traer cambios` en el banner, sin
progreso por pasos en la pantalla de carga, y sin botón `Elegir otra carpeta…` en la pantalla de
carpeta que no es un repositorio. Además: nada del servidor cambia — ni el payload, ni el umbral
de frescura, ni los códigos de error; y los chips "estado de demo" del pie de la maqueta no se
implementan, como en todos los slices anteriores.

## 2. Closed decisions (take as given)

| Decision | Value |
|---|---|
| Dónde vive la decisión de qué pantalla toca | Un módulo nuevo `web/src/screen.ts`, puro: sin React, sin fetch, sin lectura de reloj |
| Forma de esa decisión | Un vocabulario cerrado `Screen` de cinco miembros y un despacho exhaustivo sin rama por defecto |
| Cómo se despacha en TSX sin rama por defecto | La función de despacho declara su tipo de retorno `ReactElement`, así que un miembro nuevo rompe la compilación |
| Qué sustituye al par `summary`/`error` de `App.tsx` | Un solo estado `load: SummaryLoad` de tres miembros (`loading`, `loaded`, `failed`) |
| Quién decide el nombre del repo seleccionado | `ScreenChoice`, una sola vez: `App.tsx` pierde su `repoNameOf` y lee el nombre del miembro `blocks` |
| De dónde sale la frescura de la foto | Del `Clone` que devuelve `GET /repos`, nunca de `summary.meta`: es el único que está disponible en las cinco pantallas |
| Quién decide si la foto está caducada | El servidor, que ya manda `stale` en el payload; la interfaz no repite el umbral de siete días |
| Dónde vive el castellano nuevo | `web/src/format.ts`, que ya es el único sitio donde el payload en inglés se vuelve texto en castellano |
| Ventana a la que apunta la llamada a la acción | `DEFAULT_WINDOW`, es decir `12m`; en esa ventana la llamada a la acción no se dibuja |
| Cómo se exponen los componentes de un módulo `.tsx` NUEVO | Métodos estáticos de una clase con el nombre del concepto, no funciones a nivel de módulo |
| Cómo se exponen los de un módulo `.tsx` que ya estaba | Como su anfitrión: `App.tsx`, `Header.tsx` y `Pulse.tsx` siguen exportando su componente por defecto |
| Referencia visual | `docs/design/repo-pulse-mockup.html`, estados `loading`, `empty`, `norepo`, `nocommits` y el bloque `isStale` |

## 3. Reference patterns

Files to imitate: `web/src/heat-rows.ts` (módulo puro de decisiones que se pincha con cadenas
exactas, con su `web/src/heat-rows.test.ts` al lado), `web/src/format.ts` y su
`web/src/format.test.ts` (el castellano y su prueba de cadena literal), `web/src/Heat.tsx` (un
bloque que carga por su cuenta y dibuja estados), `web/src/App.test.tsx` (el doble de `fetch`
con las dos llamadas del shell), `web/src/api/types.ts` (los contratos del payload, declarados
en `web/` a mano).

Rules to obey: `AGENTS.md` — "Build, test & lint" (los tres comandos desde la raíz), "Code style
& conventions" (TypeScript estricto, ESM, código en inglés, texto visible en castellano, regla
boy scout), "Security & data handling" (ni nombres ni emails de autores en el DOM) y "Frontera
`web/` ↔ `server/`" (`web/` no importa de `server/`). Y la vara de ct que el programa pega en
cada brief, cuyos cinco documentos manda leer el arranque: tiene preferencia sobre las
convenciones de este repo regla a regla — de ahí el vocabulario cerrado en vez de la pareja de
campos, el despacho exhaustivo, el castellano en un solo sitio y los módulos nuevos sin
comentarios y con sus funciones colgando de un tipo.

## 4. Inventory

| File | Action | Consumed by | Block in §7 |
|---|---|---|---|
| `web/src/screen.ts` | create | `App.tsx`, `Header.tsx`, `Pulse.tsx` | Contract (tareas 1 y 2) |
| `web/src/screen.test.ts` | create | vitest | none (body by TDD) |
| `web/src/format.ts` | modify | `Screens.tsx`, `Header.tsx`, `Pulse.tsx`, `StaleNotice.tsx` | Contract (tarea 3) |
| `web/src/format.test.ts` | modify | vitest | none (body by TDD) |
| `web/src/Screens.tsx` | create | `App.tsx` | Contract (tarea 4) |
| `web/src/Screens.test.tsx` | create | vitest | none (body by TDD) |
| `web/src/App.tsx` | modify | `web/src/main.tsx` | Current state + Call site (tareas 5 y 7) |
| `web/src/App.test.tsx` | modify | vitest | Current state (tarea 5) |
| `web/src/Header.tsx` | modify | `App.tsx` | Current state + Contract (tarea 6) |
| `web/src/StaleNotice.tsx` | create | `App.tsx` | Contract (tarea 6) |
| `web/src/Pulse.tsx` | modify | `App.tsx` | Current state + Contract (tarea 7) |

## 5. Interfaces

Consumes: nada nuevo. El slice se apoya en lo que ya está en el árbol y que los slices `#5` y
`#6` dejaron cerrado — `fetchRepos(signal) => Promise<Clone[]>` y
`fetchSummary(id, window, signal) => Promise<Summary>` de `web/src/api/client.ts`, la clase
`ApiError` con su `code: ApiErrorCode`, y los tipos `Clone`, `Summary`, `SummaryMeta`,
`TimeWindow`, `ApiErrorCode`, `WINDOWS` y `DEFAULT_WINDOW` de `web/src/api/types.ts`. Del
payload usa tres campos como señal de estado: `Summary.headSha` (`null` cuando el repo no tiene
ningún commit), `Summary.kpis.commits` y `Clone.fetchedAt` con `Clone.stale`.

Produces, para el resto de la interfaz: `SummaryLoad`, `Screen`, `Activity`, `EmptyWindowCta`,
`Selection`, `SnapshotNotice`, `HeaderHistory` y `Dashboard` como tipos de
`web/src/screen.ts`; `ScreenChoice.of(selection: Selection) => Dashboard` como única decisión de
pantalla; `Screens.Analysing`, `Screens.NotAGitRepo`, `Screens.NoCommits` y `Screens.Failed`
como componentes de `web/src/Screens.tsx`; `StaleNotice.Banner` como componente de
`web/src/StaleNotice.tsx`; y en `web/src/format.ts` las funciones y constantes de castellano que
la tarea 3 declara.

## 6. Test strategy

Vitest en los dos workspaces, con los comandos de `AGENTS.md`: `npm test` desde la raíz corre
los dos; `npm test -w web` corre solo el de la interfaz. Nada de este slice toca `server/`, así
que su suite se usa como red de seguridad y no crece.

Tres niveles, de dentro afuera. Las decisiones de pantalla se pinchan en `web/src/screen.test.ts`
sobre `ScreenChoice.of`, con objetos reales y sin React: es donde se compara el miembro del
vocabulario, que es lo que ninguna aserción sobre el DOM distingue bien. El castellano se pincha
en `web/src/format.test.ts` con la cadena literal completa, como las diecinueve pruebas que ya
hay. Y los cuatro criterios de aceptación se pinchan de extremo a extremo en
`web/src/App.test.tsx`, con el doble de `fetch` que ya existe allí, porque un criterio dice qué
ve una persona. `web/src/Screens.test.tsx` cubre lo que el shell no puede provocar cómodamente:
que al pulsar un clon de la lista de la pantalla de carpeta-no-repositorio se seleccione ese
clon.

Los objetos que las pruebas necesitan se construyen con madres: `web/src/App.test.tsx` ya tiene
`summaryWith(meta, overrides)` y `stubApi(meta, overrides)`, y las tareas que añaden casos las
usan en lugar de armar el payload a mano. `web/src/screen.test.ts` trae la suya, una clase
`SelectionMother` con escenarios con nombre — `loading()`, `failedWith(code)`,
`loadedWith(overrides)` — para que cada prueba nombre solo lo que su caso cambia.

Dos límites se pinchan a los dos lados. El de la llamada a la acción: en `30d` aparece y apunta
a `12m`, en `12m` no aparece. Y el de la frescura: `stale: true` pinta el banner, `stale: false`
con fecha pinta la línea y no el banner, y `fetchedAt: null` no pinta ninguna de las dos. El
umbral de siete días NO se vuelve a pinchar aquí: lo pincha ya
`server/src/repos.test.ts` con la prueba `freshnessOf declares stale only PAST seven days`, y
repetirlo en la interfaz sería escribir el umbral dos veces.

## 7. Tasks

### Task 1 — `screen.ts`: el vocabulario de pantallas y la decisión

**Objective:** un módulo puro decide, en un solo sitio y con un vocabulario cerrado, qué pantalla
corresponde a cada estado de carga del resumen.

**Files:** `web/src/screen.ts` (create), `web/src/screen.test.ts` (create)

Contract (web/src/screen.ts):

```ts
export type SummaryLoad =
  | { status: 'loading' }
  | { status: 'loaded'; summary: Summary }
  | { status: 'failed'; code: ApiErrorCode }
export type EmptyWindowCta = { kind: 'switch'; window: TimeWindow } | { kind: 'already-there' }
export type Activity = { kind: 'series' } | { kind: 'empty-window'; cta: EmptyWindowCta }
export type Screen =
  | { kind: 'analysing'; repoName: string }
  | { kind: 'not-a-git-repo'; repoId: string; clones: readonly Clone[] }
  | { kind: 'no-commits'; repoName: string }
  | { kind: 'failed'; code: ApiErrorCode }
  | { kind: 'blocks'; repoName: string; summary: Summary; activity: Activity }
export interface Selection {
  repos: readonly Clone[]
  repoId: string
  load: SummaryLoad
}
export class ScreenChoice {
  static of(selection: Selection): Screen
}
```

La regla exacta, en este orden: `failed` con código `not-a-git-repo` da el miembro
`not-a-git-repo` con `repoId` y con `clones` — que es `selection.repos` entera; cualquier otro
`failed` da `failed` con su código; `loading` da `analysing`; `loaded` con
`summary.headSha === null` da `no-commits`; `loaded` con `summary.kpis.commits === 0` da
`blocks` con actividad `empty-window`; y el resto da `blocks` con actividad `series`. El nombre
del repo es el `name` del clon cuyo `id` es `repoId`, y el propio `repoId` cuando no hay
ninguno. La llamada a la acción es `switch` a `DEFAULT_WINDOW` salvo cuando
`summary.window === DEFAULT_WINDOW`, y entonces es `already-there`.

**TDD:** rojo primero con `test('a repo with no head sha is the no-commits screen, not an empty window')`
— un `loaded` con `headSha: null` y `kpis.commits: 0` da `kind` `no-commits`, no `blocks`: es el
orden de las dos ramas lo que la prueba clava.

**Tests:** añadidos, `web/src/screen.test.ts`: `a summary still loading is the analysing screen`,
`a not-a-git-repo failure is its own screen, with the detected clones`,
`any other failure is the failed screen, carrying the code`,
`a repo with no head sha is the no-commits screen, not an empty window`,
`a window with no commits is the blocks screen with an empty-window activity`,
`the empty-window cta switches to the default window and is already-there on it`,
`a window with commits is the blocks screen with a series activity`.

**Verification:** los siete tests del módulo nuevo están y la suite de la interfaz sigue verde;
el módulo no importa React ni el cliente de la API, que es lo que lo mantiene puro.

```bash
test "$(grep -c "^test('" web/src/screen.test.ts)" -eq 7   # expected: exit 0 — los siete casos de la tarea
test "$(grep -cE "from 'react'|from './api/client'" web/src/screen.ts)" -eq 0   # expected: exit 0 — módulo puro
npm test -w web   # expected: exit 0 — screen.test.ts verde junto al resto
npm run build && npm run lint   # expected: exit 0 — tipos y estilo
```

### Task 2 — `screen.ts`: la frescura de la foto y la línea de historial

**Objective:** la misma decisión responde también qué dice la cabecera sobre el último commit y
en qué estado está la foto local, con dos vocabularios cerrados en lugar de los pares de campos
del payload.

**Files:** `web/src/screen.ts` (modify), `web/src/screen.test.ts` (modify)

Contract (web/src/screen.ts):

```ts
export type SnapshotNotice =
  | { kind: 'never-fetched' }
  | { kind: 'fresh'; fetchedAt: string }
  | { kind: 'stale'; fetchedAt: string }
export type HeaderHistory =
  | { kind: 'unknown' }
  | { kind: 'none' }
  | { kind: 'last-commit'; at: string }
export interface Dashboard {
  screen: Screen
  history: HeaderHistory
  snapshot: SnapshotNotice
}
export class ScreenChoice {
  static of(selection: Selection): Dashboard
}
```

La frescura sale del clon seleccionado de `selection.repos` y de nadie más: `fetchedAt === null`
—o no hay clon seleccionado— da `never-fetched`; `stale === true` da `stale`; el resto da
`fresh`. El `stale` se copia del payload, no se recalcula de la fecha. El historial da
`last-commit` cuando el resumen ha llegado y su `meta.lastCommitAt` no es `null`, `none` en la
pantalla `no-commits`, y `unknown` en cualquier otro caso.

**TDD:** rojo primero con `test('the snapshot notice repeats the staleness the payload declares, it does not recompute it')`
— un clon con `fetchedAt` de anteayer y `stale: true` da `kind` `stale`, y uno con `fetchedAt`
de hace un año y `stale: false` da `fresh`: una interfaz que recalculase el umbral fallaría en
los dos casos a la vez.

**Tests:** añadidos, `web/src/screen.test.ts`:
`a clone that never fetched has a never-fetched snapshot notice`,
`the snapshot notice repeats the staleness the payload declares, it does not recompute it`,
`the header history is none on the no-commits screen and unknown while loading`,
`the header history carries the last commit date of a loaded window`.

**Verification:** once tests en el módulo —los siete de la tarea 1 más estos cuatro— y la suite
verde.

```bash
test "$(grep -c "^test('" web/src/screen.test.ts)" -eq 11   # expected: exit 0 — 7 + 4
npm test -w web   # expected: exit 0
npm run build && npm run lint   # expected: exit 0
```

### Task 3 — `format.ts`: el castellano de los cinco estados

**Objective:** el texto que una persona lee entra en el único módulo que convierte el payload en
castellano, con su cadena literal pinchada.

**Files:** `web/src/format.ts` (modify), `web/src/format.test.ts` (modify)

Contract (web/src/format.ts):

```ts
export function analysingHeadline(repoName: string): string
export function emptyWindowHeadline(window: TimeWindow): string
export function emptyWindowSentence(lastCommitAt: string | null, now: Date): string
export function emptyWindowCtaLabel(window: TimeWindow): string
export function notAGitRepoSentence(repoId: string): string
export function noCommitsSentence(repoName: string): string
export function freshSnapshotLine(fetchedAt: string, now: Date): string
export function staleSnapshotLine(fetchedAt: string, now: Date): string
export function staleBannerSentence(fetchedAt: string, now: Date): string
export const NOT_A_GIT_REPO_HEADLINE = 'Esa carpeta no es un repositorio git'
export const DETECTED_CLONES_LABEL = 'clones detectados'
export const NO_COMMITS_HEADLINE = 'Repositorio sin commits'
export const NO_COMMITS_FOOTNOTE = 'Cuando entre el primer commit, esta pantalla se llena sola.'
export const NO_HISTORY_META = 'sin historial · ningún commit todavía'
```

Las cadenas exactas, con `relativeDays` como reloj:
`analysingHeadline('tienda-web')` da `Analizando tienda-web…`;
`emptyWindowHeadline('30d')` da `0 commits en 30 días` y en `all` da `0 commits en todo el historial`
—`windowLabelLong`, no `windowLabel`—; `emptyWindowSentence` da
`Es una respuesta, no un fallo: el repo está quieto en esta ventana. Su último commit fue hace 84 días.`
y con `null` se queda en `Es una respuesta, no un fallo: el repo está quieto en esta ventana.`;
`emptyWindowCtaLabel('12m')` da `Ver 12 meses`; `notAGitRepoSentence('notas-producto')` da
`En la carpeta notas-producto no hay ningún directorio .git, así que no hay historial que medir.`;
`noCommitsSentence('sandbox-notas')` da
`sandbox-notas es un repo git válido, pero su historial está vacío. No hay pulso que contar todavía.`;
`freshSnapshotLine` da `Foto local al día · traída hoy` y `staleSnapshotLine` da
`Foto local traída hace 26 días` —las dos que hoy viven dentro de `Header.tsx` y se mueven
aquí tal cual—; y `staleBannerSentence` da
`Foto local desactualizada: el clon se trajo hace 26 días. Lo que ves puede ir por detrás del remoto.`

**TDD:** rojo primero con `test('the empty window sentence drops the last commit clause when there is none')`
— con `null` la frase termina en `esta ventana.` y no contiene `último commit`, que es la mitad
que la ausencia tiene que quitar.

**Tests:** añadidos, `web/src/format.test.ts`:
`the analysing headline names the repo it is walking`,
`the empty window headline names the window in its long form`,
`the empty window sentence drops the last commit clause when there is none`,
`the cta offers the default window by its long name`,
`the not-a-git-repo sentence names the folder`,
`the no-commits sentence names the repo`,
`the fresh snapshot line and the stale one differ in more than the date`,
`the stale banner says how long ago the clone was fetched`.

**Verification:** veintisiete tests en el módulo del castellano —diecinueve de antes más ocho— y
la suite verde.

```bash
test "$(grep -c "^test('" web/src/format.test.ts)" -eq 27   # expected: exit 0 — 19 + 8
npm test -w web   # expected: exit 0
npm run build && npm run lint   # expected: exit 0
```

### Task 4 — `Screens.tsx`: las cuatro pantallas que sustituyen a los bloques

**Objective:** las cuatro pantallas de la maqueta que se dibujan en lugar de la rejilla existen
como componentes, y la de carpeta-no-repositorio ofrece la lista de clones como salida.

**Files:** `web/src/Screens.tsx` (create), `web/src/Screens.test.tsx` (create)

Contract (web/src/Screens.tsx):

```tsx
export interface AnalysingProps { repoName: string }
export interface NotAGitRepoProps {
  repoId: string
  clones: readonly Clone[]
  onRepo: (id: string) => void
}
export interface NoCommitsProps { repoName: string }
export interface FailedProps { code: ApiErrorCode }
export class Screens {
  static Analysing(props: AnalysingProps): ReactElement
  static NotAGitRepo(props: NotAGitRepoProps): ReactElement
  static NoCommits(props: NoCommitsProps): ReactElement
  static Failed(props: FailedProps): ReactElement
}
```

Cada pantalla saca su texto de `web/src/format.ts` y nada más. `Analysing` lleva el titular y una
barra de progreso indeterminada con la animación `rp-sweep` de la maqueta, y ningún paso.
`NotAGitRepo` lleva el titular `NOT_A_GIT_REPO_HEADLINE`, la frase con la carpeta, el rótulo
`DETECTED_CLONES_LABEL` y un `button` por clon con su nombre y su ruta que llama a `onRepo` con
su `id`; sin botón de elegir otra carpeta. `NoCommits` lleva titular, frase y pie. `Failed`
mantiene el `role="alert"` y el texto que `App.tsx` ya pinta hoy. La animación entra como una
regla `@keyframes` en `web/src/tokens.css`, que es donde vive el estilo global del repo.

**TDD:** rojo primero con `test('picking a clone from the not-a-git-repo list selects it')` —
pulsar el botón del segundo clon llama a `onRepo` con el `id` de ese clon y no con su `name`,
que es la confusión que la lista invita a cometer.

**Tests:** añadidos, `web/src/Screens.test.tsx`:
`the analysing screen names the repo it is walking and shows no step list`,
`the not-a-git-repo screen lists every detected clone as a way out`,
`picking a clone from the not-a-git-repo list selects it`,
`the no-commits screen says the history is empty and that it will fill itself`,
`the failed screen carries the code in an alert`.

**Verification:** los cinco tests del módulo nuevo, y ninguno de los tres botones que el issue
protege aparece en el fichero.

```bash
test "$(grep -c "^test('" web/src/Screens.test.tsx)" -eq 5   # expected: exit 0 — los cinco casos
test "$(grep -cE 'Traer cambios|Elegir otra carpeta' web/src/Screens.tsx)" -eq 0   # expected: exit 0 — fuera de alcance
npm test -w web   # expected: exit 0
npm run build && npm run lint   # expected: exit 0
```

### Task 5 — `App.tsx`: un solo estado de carga y un despacho exhaustivo

**Objective:** el shell guarda una sola pieza de estado por carga, pide la pantalla a
`ScreenChoice` y despacha sobre el vocabulario sin rama por defecto — con lo que la carpeta sin
`.git` enseña su estado diseñado con la lista de clones.

**Files:** `web/src/App.tsx` (modify), `web/src/App.test.tsx` (modify)

Current state (web/src/App.tsx, lines 88-89):

```tsx
      {error !== null && <p role="alert">No se ha podido cargar la información ({error}).</p>}
      {error === null && summary === null && <p>Cargando…</p>}
```

Call site (web/src/App.tsx):

```tsx
const [load, setLoad] = useState<SummaryLoad>({ status: 'loading' })
const { screen, history, snapshot } = ScreenChoice.of({ repos, repoId, load })
// …
<Header repos={repos} repoId={repoId} onRepo={setRepoId} window={window}
        onWindow={setWindow} history={history} snapshot={snapshot} now={now} />
{screenBody(screen)}
```

`screenBody(screen: Screen): ReactElement` es una función a nivel de módulo de `App.tsx`, como
las dos que ya tiene: un `switch` sobre `screen.kind` con un `return` por miembro y ninguna rama
por defecto, y su tipo de retorno declarado es lo que convierte un miembro nuevo en un error de
compilación. `blocks` devuelve la rejilla de hoy; los otros cuatro miembros devuelven el
componente de `Screens` que les toca. `setError` y `repoNameOf` desaparecen: el fallo de
cualquiera de las dos cargas pasa a ser `{ status: 'failed', code }`, y el nombre del repo lo
trae el miembro `blocks`, que es también el que se le pasa a `HeatBlock`.

Current state (web/src/App.test.tsx, lines 129-132):

```tsx
  expect(await screen.findByText('/git/alpha')).toBeTruthy()
  await waitFor(() => {
    expect(screen.queryByText('Cargando…')).toBeNull()
  })
```

Esa espera pasa a mirar el titular nuevo, `Analizando alpha-clone…`, en las dos pruebas que hoy
la usan para saber que la carga terminó.

**TDD:** rojo primero con `test('a folder without .git shows the designed screen with the list of clones')`
— el doble responde `not-a-git-repo` al resumen, y la pantalla trae a la vez el titular
`Esa carpeta no es un repositorio git` y un botón con el nombre del clon de la lista; con el
código genérico en su lugar la prueba cae, que es lo que separa este estado del de fallo.

**Tests:** añadidos, `web/src/App.test.tsx`:
`a folder without .git shows the designed screen with the list of clones`,
`while the summary loads the shell shows the analysing screen`,
`a repo with no commits shows the designed screen instead of the blocks`. Modificados en su
aserción, con el mismo nombre: `without dates the header shows neither` y
`changing the window asks the API for that window`.

**Verification:** los tres casos nuevos están, ya no queda ninguna referencia al texto viejo de
carga, y la suite entera sigue verde.

```bash
test "$(grep -c 'Cargando…' web/src/App.tsx web/src/App.test.tsx)" -eq 0   # expected: exit 0 — el texto viejo se fue
test "$(grep -c 'repoNameOf' web/src/App.tsx)" -eq 0   # expected: exit 0 — la decisión vive en screen.ts
npm test -w web   # expected: exit 0
npm run build && npm run lint   # expected: exit 0
```

### Task 6 — `Header.tsx` y `StaleNotice.tsx`: la frescura de la foto

**Objective:** la cabecera lee los vocabularios en lugar del par de campos, dice que no hay
historial cuando no lo hay, y un clon traído hace más de siete días enseña su banner — mientras
uno que nunca se trajo no enseña ni fecha ni banner.

**Files:** `web/src/Header.tsx` (modify), `web/src/StaleNotice.tsx` (create),
`web/src/App.tsx` (modify), `web/src/App.test.tsx` (modify)

Current state (web/src/Header.tsx, lines 24-26):

```tsx
  const lastCommitAt = meta?.lastCommitAt ?? null
  const fetchedAt = meta?.fetchedAt ?? null
  const stale = meta?.stale === true
```

Contract (web/src/Header.tsx):

```tsx
export interface HeaderProps {
  repos: readonly Clone[]
  repoId: string
  onRepo: (id: string) => void
  window: TimeWindow
  onWindow: (window: TimeWindow) => void
  history: HeaderHistory
  snapshot: SnapshotNotice
  now: Date
}
```

Contract (web/src/StaleNotice.tsx):

```tsx
export interface BannerProps { fetchedAt: string; now: Date }
export class StaleNotice {
  static Banner(props: BannerProps): ReactElement
}
```

`meta` desaparece de la cabecera. La línea del último commit se despacha sobre `history`:
`last-commit` mantiene el texto de hoy, `none` pinta `NO_HISTORY_META`, `unknown` no pinta nada.
La línea de frescura se despacha sobre `snapshot`: `fresh` y `stale` llaman a su función de
`format.ts` y `never-fetched` no pinta nada. `App.tsx` dibuja
`<StaleNotice.Banner …/>` entre la cabecera y el cuerpo solo cuando
`snapshot.kind === 'stale'`, con el estilo del bloque `isStale` de la maqueta y sin el botón de
traer cambios.

**TDD:** rojo primero con `test('a clone that never fetched shows neither a fetch date nor the banner')`
— con `fetchedAt: null` no hay ni texto `traída` ni texto `Foto local desactualizada`, y la ruta
del clon en pantalla prueba que la carga llegó y que las dos ausencias son ausencias.

**Tests:** añadidos, `web/src/App.test.tsx`:
`a clone fetched more than seven days ago shows the stale banner`,
`a clone that never fetched shows neither a fetch date nor the banner`,
`a fresh clone shows its fetch date and no banner`,
`a repo with no commits says so in the header instead of a last commit`.

**Verification:** los cuatro casos nuevos están, la interfaz no repite el umbral de siete días
en ninguna parte, y la suite verde.

```bash
test "$(grep -c "^test('" web/src/App.test.tsx)" -eq 18   # expected: exit 0 — 11 + 3 de la tarea 5 + 4
test "$(grep -rcE '7 \* 86|STALE_AFTER|sevenDays' web/src | grep -vc ':0$')" -eq 0   # expected: exit 0 — el umbral es del servidor
npm test -w web   # expected: exit 0
npm run build && npm run lint   # expected: exit 0
```

### Task 7 — `Pulse.tsx`: la ventana sin actividad y su llamada a la acción

**Objective:** una ventana con 0 commits enseña el titular con la cuenta y la ventana, la frase
que explica que no es un fallo, y el botón que lleva a 12 meses — que no aparece cuando ya se
está en 12 meses.

**Files:** `web/src/Pulse.tsx` (modify), `web/src/App.tsx` (modify),
`web/src/App.test.tsx` (modify)

Current state (web/src/Pulse.tsx, lines 5-7):

```tsx
export interface PulseProps {
  summary: Summary
}
```

Contract (web/src/Pulse.tsx):

```tsx
export interface PulseProps {
  summary: Summary
  activity: Activity
  onWindow: (window: TimeWindow) => void
}
```

El bloque despacha sobre `activity`: `series` dibuja el `svg` y los bordes de ventana que ya
dibuja, y `empty-window` los sustituye por el bloque de la maqueta —titular
`emptyWindowHeadline`, frase `emptyWindowSentence` con `summary.meta.lastCommitAt` y `now`, y la
llamada a la acción— dentro de una caja de la misma altura, para que la rejilla no salte. La
llamada a la acción se despacha a su vez sobre `cta`: `switch` pinta un `button` con
`emptyWindowCtaLabel(cta.window)` que llama a `onWindow(cta.window)`, y `already-there` no pinta
ninguno. El resto del bloque —cabecera, subtítulo y leyenda— no cambia, y Gente y Calor ya
tienen su propio vacío desde el slice `#6`. `App.tsx` le pasa `activity` del miembro `blocks`,
`onWindow` y el `now` que ya tiene.

**TDD:** rojo primero con `test('a window with zero commits shows the count and a cta to 12 meses')`
— con `kpis.commits: 0` en la ventana de 30 días la pantalla trae `0 commits en 30 días` y un
botón `Ver 12 meses` que, al pulsarlo, hace que la siguiente petición lleve `window=12m`; el
titular por sí solo no probaría que el botón lleva a algún sitio.

**Tests:** añadidos, `web/src/App.test.tsx`:
`a window with zero commits shows the count and a cta to 12 meses`,
`on the default window the empty window shows no cta`,
`a window with commits still draws the series`.

**Verification:** los tres casos nuevos están, el bloque sigue sin dibujar identidad de autor, y
la suite entera y el estilo verdes.

```bash
test "$(grep -c "^test('" web/src/App.test.tsx)" -eq 21   # expected: exit 0 — 18 + 3
npm test -w web   # expected: exit 0
npm run build && npm run lint   # expected: exit 0
```

## 8. Global verification

Los tres comandos de `AGENTS.md` desde la raíz, el recuento de los módulos que este slice crea, y
el árbol limpio: cada tarea es un commit y al terminar no puede quedar nada sin commitear.

```bash
npm run build   # expected: exit 0 — typecheck de los dos workspaces y bundle de web
npm test        # expected: exit 0 — las dos suites
npm run lint    # expected: exit 0 — ESLint sobre todo el repo
test "$(grep -c "^test('" web/src/screen.test.ts)" -eq 11   # expected: exit 0 — el módulo de decisión
test "$(grep -c "^test('" web/src/App.test.tsx)" -eq 21   # expected: exit 0 — los cuatro criterios de extremo a extremo
test -z "$(git status --porcelain)"   # expected: exit 0 — nada sin commitear
```

Y a ojo, que es lo que cierra el gate `visual`: `npm run build -w server` y `npm start -w server`
con `REPO_PULSE_ROOT` apuntando a una carpeta que tenga a la vez un clon con `FETCH_HEAD` viejo,
un clon recién traído, un clon sin commits y una carpeta que no sea un repositorio git; luego
`npm run dev -w web` y comparar las cinco pantallas con la maqueta
`docs/design/repo-pulse-mockup.html`. El estado de carpeta-no-repositorio se alcanza pidiendo el
resumen de esa carpeta, que `GET /repos` no lista pero `GET /repos/<carpeta>/summary` sí resuelve.
La captura del antes y del después de cada estado va en el cuerpo del PR.

## 9. Assumptions

1. **La entrada real del slice está en la sección "Contexto del epic" del issue, no en su
   sección "Acceptance criteria".** Esa segunda sección trae todavía la línea de la plantilla sin
   rellenar, mientras que el bloque de contexto reproduce el cuerpo del slice `#7` del epic con
   sus cuatro criterios, sus dependencias, sus gates y su "Out of scope / Protected". El plan se
   escribe contra esos cuatro criterios. Procedencia: cuerpo del issue. El título
   (`XOP-4909 prueba`) y la descripción (`prueba`) no describen trabajo y no se han usado.
2. **Los componentes de un módulo `.tsx` nuevo cuelgan de una clase como métodos estáticos.** La
   vara de ct prohíbe funciones a nivel de módulo y tiene preferencia sobre la convención de este
   repo regla a regla; los cinco componentes que ya existen se quedan como están porque son deuda
   declarada y media migración se lee peor que ninguna. Procedencia: decisión propia sobre un
   choque real entre la vara y el idioma de React.
3. **La frase de carpeta-no-repositorio nombra la carpeta, no su ruta.** La maqueta escribe
   `~/clones/notas-producto`, pero el sobre de error del servidor no lleva ninguna ruta y la
   carpeta no está en `GET /repos`: lo único que la interfaz tiene es el identificador, que es el
   nombre de la carpeta. Procedencia: decisión propia, obligada por el payload.
4. **La frase de repositorio-sin-commits no nombra la rama ni cuenta autores.** La maqueta dice
   `rama main, 0 commits, 0 autores`; el payload no trae el nombre de la rama, así que la frase se
   queda en el hecho. Procedencia: decisión propia, obligada por el payload.
5. **La frescura sale del `Clone` de `GET /repos` y no de `summary.meta`.** Los dos la traen, y
   dos sitios decidiendo lo mismo acaban contradiciéndose; se elige el que está disponible también
   mientras el resumen carga, que es cuando la maqueta ya enseña el banner. Procedencia: decisión
   propia sobre una regla de la vara.
6. **El aviso de frescura no se oculta en la pantalla de repositorio sin commits.** La maqueta lo
   oculta ahí, pero eso es cableado de sus chips de demo y el criterio de aceptación dice, sin
   condición, que un clon con `FETCH_HEAD` de más de siete días enseña el banner. Procedencia:
   decisión propia, declarada por divergir de la referencia visual.
7. **En la ventana de 12 meses el estado vacío no dibuja la llamada a la acción.** El criterio
   pide una llamada a 12 meses; estando ya en 12 meses el botón no llevaría a ninguna parte, y un
   botón que no hace nada es peor que su ausencia. Procedencia: decisión propia.
8. **Una raíz de clones sin ningún clon se queda en la pantalla de carga.** No hay estado
   diseñado para ese caso en la maqueta ni criterio que lo cubra, y añadir uno significaría
   inventar texto de producto. Se deja declarado en lugar de resuelto a ojo. Procedencia: decisión
   propia.
9. **`meta.lastCommitAt` sigue entrando en `format.ts` como `string | null`.** La ausencia viene
   del contrato del servidor, que este slice no toca, y `formatEdge` ya la trata igual en el mismo
   módulo. Procedencia: convención del repo, frontera `web/` ↔ `server/` de `AGENTS.md`.
10. **La animación de la barra indeterminada entra en `web/src/tokens.css`.** Es el único sitio
    donde el repo tiene estilo global, y la maqueta la declara como `@keyframes` en su `helmet`.
    Procedencia: convención del repo.
