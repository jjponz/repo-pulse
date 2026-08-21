# #6 — UI: gente y calor contra `GET /heat` y `PUT /settings`

> **This plan is written to be executed by task-scoped subagents with zero context and no
> authority to decide.** Every task carries the current state of what it touches (copied
> verbatim), the contracts it must honour and the exact commands that verify it — not the
> bodies: those you write test-first. Do not improvise on names, signatures, constants or test
> names: they are decided here. On ambiguity, the issue body and AGENTS.md win.

## 1. Context and goal

`web/` es hoy el shell del #5: `web/src/App.tsx` carga `GET /api/repos` y
`GET /api/repos/:id/summary?window=` con `web/src/api/client.ts`, guarda el `Summary` en estado
y pinta `web/src/Header.tsx`, `web/src/Pulse.tsx` y `web/src/TrendPanel.tsx` dentro de un grid
de dos columnas. Los textos en español viven en `web/src/format.ts`, la aritmética del gráfico
en `web/src/pulse-points.ts` y los tipos del payload en `web/src/api/types.ts` (que NO importa
de `server/`). El server del #4 ya sirve `GET /api/repos/:id/heat?window=&path=` y
`PUT /api/repos/:id/settings`; ninguno de los dos se llama todavía desde `web/`.

Este slice monta los dos bloques que faltan de la maqueta: **Gente** (serie de autores activos
por cubo + barra de concentración, columna izquierda, bajo Pulso) y **Calor** (breadcrumb,
drill-down por niveles hasta fichero, filas con barra y %, columna derecha, bajo Tendencia), más
un selector de carpeta principal que persiste contra `PUT /settings` y reacota los % del Calor.

### Desired end state

- Pinchar una fila de carpeta del Calor baja un nivel; se baja hasta ver ficheros, que son
  filas no navegables; el breadcrumb vuelve a cualquier nivel ya recorrido.
- Cambiar la carpeta principal en su selector guarda contra `PUT /settings`, reancla el
  drill-down y repinta los % del Calor; al volver a abrir el repo, el `GET /heat` devuelve esa
  carpeta y el bloque arranca ahí.
- Cuando el `GET /heat` responde `fallback: true`, el bloque avisa de que la guardada ya no
  existe y de a qué carpeta se ha acotado.
- El bloque Gente dibuja autores activos por cubo y la concentración; ningún nombre de autor
  aparece en el DOM, ni ningún campo de identidad en `web/src/api/types.ts`.

### Out of scope

Los chips «estado de demo» del pie de la maqueta no se implementan (contexto del epic). No se
toca `server/` — ni un endpoint nuevo, ni el `settings.json`, ni el análisis: este slice consume
la API del #4 tal como está mergeada. Tampoco las pantallas de estado no feliz del #7 (carga
diseñada, ventana vacía con CTA, no-repo, sin commits, banner de desactualizado) ni el botón
«Traer cambios»: mientras no hay datos el cuerpo sigue siendo el `Cargando…` mínimo del #5 y un
error sigue siendo una línea con su `code`. La sección "Out of scope / Protected" del issue no
declara ninguno.

## 2. Closed decisions (do NOT reopen)

| Decision | Value |
|---|---|
| Frontera de tipos | `web/` NO importa de `server/`: `Heat` y `HeatEntry` se declaran a mano en `web/src/api/types.ts` (AGENTS.md, «Frontera `web/` ↔ `server/`») |
| Fuente de los % | el `percent` entero que manda el server, nunca recalculado en la UI: es lo que el AC llama «los % del Calor» |
| Fuente del `mainFolder` | el `mainFolder` que devuelve `GET /heat`; la UI no guarda nada en `localStorage` — «se recuerda» lo cumple el server |
| Selector de carpeta principal | un `<select aria-label="Carpeta principal">` cuyas opciones son la raíz (`''`), los niveles del breadcrumb y los hijos de tipo `dir` del nivel actual: la API del #4 no expone ningún listado de directorios independiente del `mainFolder`, así que lo ofrecido es lo que se ve |
| Datos de Gente | `summary.buckets[].authors` y `summary.concentration`, ya en el payload que carga `App`: Gente no hace ninguna petición nueva |
| Estado del drill-down | vive en `web/src/Heat.tsx`, no en `App`: es una dimensión de navegación que ningún otro bloque comparte. `App` lo remonta con `key={`${repoId}|${window}`}` para resetear el nivel |
| Filas de fichero | se pintan como `<div>`, no como `<button>`: en la maqueta un fichero no navega, y un botón que no hace nada miente al lector de pantalla |
| Tope de filas | 8, como `rows.slice(0, 8)` de la maqueta; el pie sigue contando TODOS los hijos tocados |
| Geometría de series | `web/src/pulse-points.ts` se renombra a `web/src/series-points.ts` y parametriza la geometría: Gente reusa la misma aritmética con otra línea base, y un módulo llamado «pulse» importado desde Gente miente |
| Tokens de marca | no se tocan: `web/src/tokens.css` queda intacto y todo color sale de sus variables |
| Pie del Calor | la maqueta dice «el % es sobre el total del repo, no sobre la carpeta»; aquí el denominador es la carpeta principal, así que el texto pasa a «el % es sobre el total de la carpeta principal» |

## 3. Reference patterns

Files to imitate: `web/src/Pulse.tsx` (bloque con `<svg>` y estilos en línea desde tokens),
`web/src/TrendPanel.tsx` (bloque de la columna derecha con `data-testid` por dato),
`web/src/format.ts` (los textos en español, puros y sin DOM), `web/src/pulse-points.ts`
(aritmética pura pineada con strings exactos), `web/src/App.test.tsx` (doble de `fetch` con
`vi.stubGlobal` y `fireEvent`), `web/src/api/client.ts` (sobre de error tipado),
`docs/design/repo-pulse-mockup.html` (referencia visual obligatoria de los dos bloques).

Rules to obey: `AGENTS.md` (código en inglés, textos de UI en español, frontera `web/` ↔
`server/`, comandos de build/test/lint, regla boy scout), `docs/design/repo-pulse-mockup.html`.

## 4. Inventory

| File | Action | Consumed by | Block in §7 |
|---|---|---|---|
| `web/src/api/types.ts` | modify | cliente, `Heat.tsx` | Contract (Task 1) |
| `web/src/api/client.ts` | modify | `Heat.tsx` | Current state + Contract (Task 1) |
| `web/src/api/client.test.ts` | modify | — | none (tests by TDD) |
| `web/src/series-points.ts` | create (rename de `pulse-points.ts`) | `Pulse.tsx`, `People.tsx` | Current state + Contract (Task 2) |
| `web/src/series-points.test.ts` | create (rename) | — | none (tests by TDD) |
| `web/src/pulse-points.ts` | delete (renombrado) | — | none |
| `web/src/pulse-points.test.ts` | delete (git lo presenta como rename) | — | none |
| `web/src/Pulse.tsx` | modify | `App.tsx` | Call site (Task 2) |
| `web/src/format.ts` | modify | `People.tsx`, `Heat.tsx` | Contract (Task 3) |
| `web/src/format.test.ts` | modify | — | none (tests by TDD) |
| `web/src/heat-rows.ts` | create | `Heat.tsx` | Contract (Task 4) |
| `web/src/heat-rows.test.ts` | create | — | none (tests by TDD) |
| `web/src/People.tsx` | create | `App.tsx` | Contract (Task 5) |
| `web/src/App.tsx` | modify | — | Current state + Call site (Tasks 5, 6) |
| `web/src/App.test.tsx` | modify | — | none (tests by TDD) |
| `web/src/Heat.tsx` | create | `App.tsx` | Contract (Tasks 6, 7) |
| `web/src/Heat.test.tsx` | create | — | none (tests by TDD) |

## 5. Interfaces

Consumes (del #5/#4, ya mergeado): `GET /api/repos/:id/heat?window=&path=` responde
`{window, mainFolder, fallback, path, commits, mainFolderCommits, headSha, children[]}` con
`children[] = {name, kind: 'dir'|'file', commits, percent}` ordenado por `commits` descendente y
`percent` entero sobre `mainFolderCommits`; el `path` viaja en la query y el `mainFolder` NUNCA
(lo lee el server de sus settings). `PUT /api/repos/:id/settings` recibe `{mainFolder: string}`
(`''` es la raíz y es legal) y responde `{mainFolder}`; un body de otra forma es
`invalid-body`. Errores en el sobre `{error:{code,message}}` con los `code` de
`web/src/api/types.ts`. Del `Summary` que ya carga `App`: `buckets[].authors`,
`concentration.authors`, `concentration.percentage`, `bucket`, `kpis.commits`.

Produces (para el #7): `fetchHeat(id, window, path?, signal?) => Promise<Heat>`;
`saveMainFolder(id, mainFolder, signal?) => Promise<{mainFolder: string}>`; los tipos `Heat` y
`HeatEntry`; `People({summary})` y `HeatBlock({repoId, repoName, window})` como componentes por
defecto de `web/src/People.tsx` y `web/src/Heat.tsx`; de `web/src/series-points.ts`:
`SeriesGeometry`, `PULSE_GEOMETRY`, `PEOPLE_GEOMETRY`, `seriesMax`, `polylinePoints`,
`areaPoints`; de `web/src/format.ts`: `windowLabelLong`, `concentrationSentence`,
`mainFolderLabel`, `heatFooter`, `noHeatHeadline`, `fallbackNotice`; de `web/src/heat-rows.ts`:
`HEAT_ROW_LIMIT`, `HeatRow`, `Crumb`, `heatRows`, `breadcrumb`, `mainFolderOptions`.

## 6. Test strategy

Vitest en `web/` (`npm test -w web`, jsdom + Testing Library, ya montado por el #5). Los módulos
puros (`series-points.ts`, `format.ts`, `heat-rows.ts`) se pinean con strings y números exactos,
sin DOM. Los componentes se prueban a través de `App` cuando lo que se afirma es el montaje
(Gente en la columna izquierda) y directamente contra `Heat.tsx` cuando lo que se afirma es su
navegación, doblando `fetch` con `vi.stubGlobal` como en `web/src/App.test.tsx` y disparando con
`fireEvent`. Ningún test toca la red ni el server real. El AC «ningún nombre de autor aparece en
el DOM» se pinea con un test que renderiza el dashboard completo con un payload que sí trae
conteos y afirma que el DOM no contiene ninguna cadena de identidad — no con un grep.

## 7. Tasks

### Task 1 — `Heat` en los tipos y en el cliente

**Objective:** `web/` sabe pedir el calor de un nivel y guardar la carpeta principal.

**Files:** `web/src/api/types.ts` (modify), `web/src/api/client.ts` (modify),
`web/src/api/client.test.ts` (modify)

Current state (web/src/api/client.ts, lines 38-47):

```ts
async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    throw new ApiError('internal', messageOf(error))
  }
  if (!response.ok) throw await errorFrom(response)
  return (await response.json()) as T
}
```

Contract (web/src/api/types.ts):

```ts
export interface HeatEntry {
  name: string
  kind: 'dir' | 'file'
  commits: number
  percent: number
}

export interface Heat {
  window: TimeWindow
  mainFolder: string
  fallback: boolean
  path: string
  commits: number
  mainFolderCommits: number
  headSha: string | null
  children: HeatEntry[]
}
```

En `Heat`, `mainFolder` y `path` usan `''` para la raíz del clon, `fallback` es `true` cuando
la carpeta guardada ya no existe en HEAD, y `HeatEntry.percent` es un entero sobre
`mainFolderCommits` que NO suma 100 entre las filas.

Contract (web/src/api/client.ts):

```ts
export function fetchHeat(id: string, window: TimeWindow, path?: string, signal?: AbortSignal): Promise<Heat>
export function saveMainFolder(id: string, mainFolder: string, signal?: AbortSignal): Promise<{ mainFolder: string }>
async function request<T>(url: string, options?: { signal?: AbortSignal; method?: 'PUT'; body?: unknown }): Promise<T>
```

`request` gana el segundo parámetro y los dos call sites existentes (`fetchRepos`,
`fetchSummary`) pasan a `request<T>(url, { signal })`; con `method` y `body` presentes añade
`headers: {'Content-Type': 'application/json'}` y `body: JSON.stringify(options.body)`. La URL
del calor es `/api/repos/{encodeURIComponent(id)}/heat?window={window}`, y `path` se añade como
`&path={encodeURIComponent(path)}` **solo cuando no es `undefined`** — `''` es un valor legítimo
(la raíz) y se manda. La de settings es `/api/repos/{encodeURIComponent(id)}/settings`.

**TDD:** `test('asks the heat for the level it is given')` — `fetchHeat('alpha', '90d', 'src/ui')`
llama a `fetch` con `/api/repos/alpha/heat?window=90d&path=src%2Fui`; y
`test('the root level travels as an empty path, not as no path')` — `fetchHeat('alpha', '90d', '')`
llama con `…&path=` y `fetchHeat('alpha', '90d')` llama SIN `path`: es el par que discrimina
«raíz» de «sin acotar». Luego el mínimo verde.

**Tests:** añadidos: 'asks the heat for the level it is given',
'the root level travels as an empty path, not as no path',
'saves the main folder with a PUT and a JSON body',
'a rejected main folder surfaces its code' (sobre el codigo invalid-body).

**Verification:** la suite de `web/` pasa con los tests nuevos y el typecheck no se rompe.

```bash
npm test -w web   # expected: exit 0 — los 4 tests nuevos de client.test.ts en verde
npm run build     # expected: exit 0 — tsc de web/ acepta los tipos nuevos
npm run lint      # expected: exit 0
```

### Task 2 — `series-points.ts`: una geometría por serie

**Objective:** la aritmética del gráfico sirve a dos series con líneas base distintas, sin
cambiar un solo punto de los que ya dibuja el Pulso.

**Files:** `web/src/series-points.ts` (create), `web/src/series-points.test.ts` (create),
`web/src/pulse-points.ts` (delete), `web/src/Pulse.tsx` (modify)

Current state (web/src/pulse-points.ts, lines 31-39):

```ts
export function polylinePoints(values: readonly number[], max: number): string {
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * PULSE_WIDTH
      const y = PULSE_BASELINE - (value / max) * (PULSE_BASELINE - PULSE_HEADROOM)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
```

Contract (web/src/series-points.ts):

```ts
export interface SeriesGeometry { width: number; baseline: number; headroom: number }
export const PULSE_GEOMETRY: SeriesGeometry = { width: 600, baseline: 199, headroom: 6 }
export const PEOPLE_GEOMETRY: SeriesGeometry = { width: 600, baseline: 109, headroom: 6 }
export function seriesMax(...series: readonly (readonly number[])[]): number
export function polylinePoints(values: readonly number[], max: number, geometry?: SeriesGeometry): string
export function areaPoints(points: string, geometry?: SeriesGeometry): string
```

`geometry` por defecto es `PULSE_GEOMETRY` en las dos funciones, y la fórmula es la citada
arriba con `geometry.width` / `geometry.baseline` / `geometry.headroom` en lugar de las tres
constantes. `PULSE_WIDTH`, `PULSE_BASELINE` y `PULSE_HEADROOM` dejan de exportarse. El origen de
los dos create es un `git mv` de `web/src/pulse-points.*`, no una copia; la ruta vieja del test
no se declara arriba porque git detecta su rename y solo la presenta por el destino.

Call site (web/src/Pulse.tsx):

```tsx
// antes: import { PULSE_BASELINE, PULSE_WIDTH, areaPoints, polylinePoints, seriesMax } from './pulse-points'
// ahora:
import { PULSE_GEOMETRY, areaPoints, polylinePoints, seriesMax } from './series-points'
// y en el JSX: viewBox={`0 0 ${PULSE_GEOMETRY.width} 200`}, y1={PULSE_GEOMETRY.baseline},
// x2={PULSE_GEOMETRY.width}, y2={PULSE_GEOMETRY.baseline}
```

**TDD:** `test('a geometry with another baseline scales to that baseline')` — `polylinePoints([0, 1], 1, PEOPLE_GEOMETRY)`
es `'0.0,109.0 600.0,6.0'`, mientras `polylinePoints([0, 1], 1)` sigue siendo
`'0.0,199.0 600.0,6.0'`: el par pina que el default no se movió. Luego el mínimo verde.

**Tests:** los 3 de `pulse-points.test.ts` viajan tal cual al fichero renombrado; añadido:
'a geometry with another baseline scales to that baseline'. Los dos tests de `App.test.tsx` que
pinean las cadenas de puntos del Pulso NO se tocan: son la prueba de que el refactor no movió
nada.

**Verification:** el rename no deja rastro del módulo viejo y el Pulso dibuja los mismos puntos.

```bash
test ! -e web/src/pulse-points.ts                                  # expected: exit 0 — renombrado, no copiado
test "$(grep -rl "pulse-points" web/src | wc -l)" -eq 0            # expected: exit 0 — ningún import viejo
npm test -w web                                                    # expected: exit 0 — App.test.tsx sigue verde con los puntos de siempre
npm run build                                                      # expected: exit 0
```

### Task 3 — los textos de Gente y Calor

**Objective:** todo el español nuevo vive en `web/src/format.ts`, puro y pineado.

**Files:** `web/src/format.ts` (modify), `web/src/format.test.ts` (modify)

Contract (web/src/format.ts):

```ts
export function windowLabelLong(window: TimeWindow): string
export function concentrationSentence(concentration: Concentration, commits: number): string
export function mainFolderLabel(mainFolder: string): string
export function heatFooter(children: number, hereCommits: number, mainFolderCommits: number): string
export function noHeatHeadline(window: TimeWindow): string
export function fallbackNotice(mainFolder: string): string
```

Los literales, cerrados (de la maqueta, adaptados donde el denominador cambia):

- `windowLabelLong`: `'30 días'`, `'90 días'`, `'12 meses'`, y `'todo el historial'` para `all`.
- `concentrationSentence`: con `commits === 0`, `'Nadie ha tocado el repo en esta ventana.'`;
  con `authors === 1`, `` `1 persona concentra ${percentage}% de los commits` ``; en el resto,
  `` `${authors} personas concentran ${percentage}% de los commits` ``.
- `mainFolderLabel`: `''` → `'todo el repo'`; cualquier otra, el path tal cual.
- `heatFooter`: con `children === 0`,
  `'El árbol sigue ahí; en esta ventana nadie lo ha tocado.'`; en el resto,
  `` `${children} hijo(s) tocado(s) · ${hereCommits} commits aquí · total de la carpeta principal ${mainFolderCommits}` ``
  con el singular `1 hijo tocado` y el plural `N hijos tocados`.
- `noHeatHeadline`: `` `Ninguna carpeta tocada en ${windowLabelLong(window)}` ``.
- `fallbackNotice`: `` `La carpeta principal guardada ya no existe en HEAD: el calor se acota a ${mainFolderLabel(mainFolder)}.` ``

**TDD:** `test('one author concentrating is singular, two are plural')` — `concentrationSentence({authors: 1, percentage: 80}, 42)`
es `'1 persona concentra 80% de los commits'` y con `authors: 2`,
`'2 personas concentran 80% de los commits'`: el par pina la frontera del singular, que es la
única decisión que la frase puede romper. Luego el mínimo verde, función a función.

**Tests:** añadidos: 'one author concentrating is singular, two are plural',
'with no commits nobody has touched the repo',
'the long label of the full window is the whole history',
'the root reads as the whole repo', 'one touched child is singular, two are plural',
'with no touched children the footer says the tree is still there',
'the fallback notice names the folder it fell back to'.

**Verification:** los textos quedan pineados y nada más se movió.

```bash
npm test -w web   # expected: exit 0 — los 7 tests nuevos de format.test.ts en verde
npm run lint      # expected: exit 0
```

### Task 4 — `heat-rows.ts`: filas, breadcrumb y opciones de carpeta

**Objective:** la aritmética y la navegación del Calor son funciones puras, pineables sin DOM.

**Files:** `web/src/heat-rows.ts` (create), `web/src/heat-rows.test.ts` (create)

Contract (web/src/heat-rows.ts):

```ts
import type { HeatEntry } from './api/types'

/** Rows the mockup draws at most (`rows.slice(0, 8)`). */
export const HEAT_ROW_LIMIT = 8

export interface HeatRow extends HeatEntry {
  /** CSS width of the bar, relative to the hottest row of the level */
  barWidth: string
  /** within 10% of the hottest row: drawn in the strongest ink */
  hottest: boolean
}

/** One step of the breadcrumb; `path` is what the API is asked for when it is clicked. */
export interface Crumb { label: string; path: string }

export function heatRows(children: readonly HeatEntry[]): HeatRow[]
export function breadcrumb(repoName: string, mainFolder: string, path: string): Crumb[]
export function mainFolderOptions(mainFolder: string, path: string, children: readonly HeatEntry[]): string[]
```

Reglas cerradas:

- `heatRows`: las primeras `HEAT_ROW_LIMIT` entradas en el orden en que llegan (el server ya
  ordena por `commits` descendente); `top` es el `percent` de la primera; `barWidth` es
  `` `${Math.max(2, (percent / top) * 100).toFixed(1)}%` `` y `'2.0%'` cuando `top === 0`;
  `hottest` es `top > 0 && percent >= top * 0.9`.
- `breadcrumb`: el primer `Crumb` es `{label: mainFolder === '' ? repoName : mainFolder, path: mainFolder}`;
  después, un `Crumb` por cada segmento de `path` por debajo de `mainFolder`, con el segmento
  como `label` y el camino acumulado desde la raíz del clon como `path`.
- `mainFolderOptions`: `''` primero, después cada `path` de `breadcrumb` que no sea `''`,
  después `mainFolder` si aún no está, y después cada hijo con `kind === 'dir'` como
  `` `${path}/${name}` `` (o `name` cuando `path === ''`). Sin repetidos y en ese orden.

**TDD:** `test('the bar of the hottest row fills the level and the coldest keeps a stub')` —
con `percent` `40`, `36` y `1`, los `barWidth` son `'100.0%'`, `'90.0%'` y `'2.5%'` y `hottest`
es `true`, `true`, `false`: pina a la vez el umbral del 0,9 (36 entra, 1 no) y el mínimo de 2.
Luego el mínimo verde, función a función.

**Tests:** añadidos: 'the bar of the hottest row fills the level and the coldest keeps a stub',
'a level with no commits still draws stub bars', 'at most eight rows are drawn',
'the breadcrumb starts at the repo when nothing is scoped',
'the breadcrumb starts at the main folder and walks down to the level',
'the options offer the root, the walked levels and the folders in sight',
'the saved main folder is always an option'.

**Verification:** el módulo es puro (ni React ni `fetch`) y los umbrales quedan pineados.

```bash
npm test -w web                                                          # expected: exit 0 — los 7 tests nuevos en verde
test "$(grep -cE "from 'react'|fetch\(" web/src/heat-rows.ts)" -eq 0     # expected: exit 0 — módulo puro
npm run build                                                            # expected: exit 0
```

### Task 5 — el bloque Gente

**Objective:** bajo el Pulso se ve cuánta gente toca el repo y cuánto concentran los que más,
sin un solo nombre de autor en el DOM.

**Files:** `web/src/People.tsx` (create), `web/src/App.tsx` (modify),
`web/src/App.test.tsx` (modify)

Contract (web/src/People.tsx):

```tsx
export interface PeopleProps { summary: Summary }
export default function People({ summary }: PeopleProps)
```

La composición, de `docs/design/repo-pulse-mockup.html` (bloque «Gente»): cabecera con `Gente`
a 30px/600, el subtítulo `¿cuánta gente lo toca? ¿depende de pocos?` a 17px en
`--color-neutral-600` y, a la derecha, `` `autores activos por ${bucketNoun(summary.bucket)}` ``.
Debajo un `<svg viewBox="0 0 600 110" preserveAspectRatio="none" role="img" aria-label="Gente">`
de 130px de alto con una `<polyline data-testid="people-authors">` de
`polylinePoints(summary.buckets.map((b) => b.authors), seriesMax(...), PEOPLE_GEOMETRY)` en
`--color-accent-2` a 2.5, y la línea base en `y=109` en `--color-text` a 1.5. Debajo, la barra
de concentración: caja de 28px con `border: 1px solid var(--color-text)`, dentro un
`<div data-testid="concentration-bar">` de `width: ${percentage}%` en `--color-text` y el resto
en `--color-neutral-200`; al lado, `concentrationSentence(summary.concentration, summary.kpis.commits)`
a 20px. Cierra la nota a 15px en `--color-neutral-600`: `Solo reparto: los nombres de los
autores no aparecen en ninguna parte de la herramienta.`

Call site (web/src/App.tsx):

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 440px', gap: 64, alignItems: 'start' }}>
  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 48 }}>
    <Pulse summary={summary} />
    <People summary={summary} />
  </div>
  <TrendPanel window={window} trend={summary.trend} kpis={summary.kpis} />
</div>
```

**TDD:** `test('no author identity reaches the DOM')` — se renderiza `App` con un payload de
`concentration: {authors: 2, percentage: 80}` y `activeAuthors: 7`, y se afirma que
`document.body.textContent` contiene `'2 personas concentran 80% de los commits'` y NO contiene
`'@'` ni ninguna de las cadenas de identidad que el doble mete de más en el payload
(`'ada@example.com'`, `'Ada Lovelace'`): la presencia de la frase prueba que el bloque se pintó,
así que las dos ausencias son ausencias y no una pantalla vacía. Luego el mínimo verde.

**Tests:** añadidos a `App.test.tsx`: 'no author identity reaches the DOM',
'the people block draws active authors per bucket',
'the concentration bar is as wide as its percentage'.

**Verification:** Gente cuelga de la columna izquierda y el AC de identidad queda pineado.

```bash
npm test -w web   # expected: exit 0 — los 3 tests nuevos de App.test.tsx en verde
npm run build     # expected: exit 0
npm run lint      # expected: exit 0
```

### Task 6 — el bloque Calor: breadcrumb y drill-down hasta fichero

**Objective:** se baja de carpeta en carpeta hasta ver ficheros, y el breadcrumb vuelve a
cualquier nivel recorrido.

**Files:** `web/src/Heat.tsx` (create), `web/src/Heat.test.tsx` (create),
`web/src/App.tsx` (modify), `web/src/App.test.tsx` (modify)

Contract (web/src/Heat.tsx):

```tsx
export interface HeatBlockProps { repoId: string; repoName: string; window: TimeWindow }
export default function HeatBlock({ repoId, repoName, window }: HeatBlockProps)
```

Estado propio: `path: string | undefined` (`undefined` deja que el server ancle el nivel en la
carpeta principal), `heat: Heat | null`, `error: ApiErrorCode | null`. Un `useEffect` con deps
`[repoId, window, path]` y un `AbortController`, como en `App.tsx`: `setHeat(null)` antes de
cargar, y nada se escribe si se abortó. El error va en
`<p role="alert">No se ha podido cargar el calor ({code}).</p>`.

La composición sale del bloque «Calor» de la maqueta, con sus tipografías y colores:
cabecera `Calor` + `¿dónde arde?`, y a la derecha `← subir`, `disabled` y en
`--color-neutral-400` cuando el nivel ya es el primer `Crumb`. Debajo,
`<nav data-testid="heat-breadcrumb">` con un `<button>` por `Crumb` de
`breadcrumb(repoName, heat.mainFolder, heat.path)`, separados por `/`, que hacen
`setPath(crumb.path)`. Si `heatRows(heat.children)` está vacío, en vez de filas:
`noHeatHeadline(window)` y `Sin commits en la ventana no hay reparto que medir.`. Cada `HeatRow`
es un `<button data-testid="heat-row">` que hace `setPath` del hijo si `kind === 'dir'`, y un
`<div data-testid="heat-row">` si es `'file'`: barra de `barWidth` en `--color-accent`
(carpeta) o `--color-accent-2` (fichero), el nombre con `/` detrás si es carpeta, los `commits`,
`` `${percent}%` `` en `--color-text` si `hottest` y `--color-neutral-800` si no, y `›` solo en
las carpetas. El pie es `heatFooter(heat.children.length, heat.commits, heat.mainFolderCommits)`
seguido de ` · el % es sobre el total de la carpeta principal.`

Call site (web/src/App.tsx):

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
  <TrendPanel window={window} trend={summary.trend} kpis={summary.kpis} />
  <HeatBlock key={`${repoId}|${window}`} repoId={repoId} repoName={repoNameOf(repos, repoId)} window={window} />
</div>
```

**TDD:** `test('the drill-down goes down to files and the breadcrumb comes back to any level')` —
con un doble de `fetch` que responde por `path` (`src` → `checkout` y `ui`; `src/checkout` →
`pago`; `src/checkout/pago` → los ficheros `pago.ts` y `total.ts`), se pincha `checkout`, luego
`pago`, se afirma que las filas de ficheros existen y que NINGUNA es un `<button>`, y luego se
pincha el crumb `src` y la lista vuelve a `checkout`/`ui`: volver al primer nivel desde el
tercero es lo que pina «cualquier nivel», y no la vuelta al anterior, que `← subir` ya cubre.

**Tests:** añadidos a `Heat.test.tsx`:
'the drill-down goes down to files and the breadcrumb comes back to any level',
'going up one level asks for the parent', 'a failed load reports its code',
'a level nobody touched says so instead of drawing rows'. Añadido a `App.test.tsx`:
'the heat block hangs from the right column and reloads on a window change'.

**Verification:** el drill-down y el breadcrumb quedan pineados.

```bash
npm test -w web   # expected: exit 0 — los 5 tests nuevos en verde
npm run build     # expected: exit 0
npm run lint      # expected: exit 0
```

### Task 7 — el selector de carpeta principal

**Objective:** elegir otra carpeta principal reacota los % del Calor, se guarda en el server y
sigue ahí al volver a abrir el repo.

**Files:** `web/src/Heat.tsx` (modify), `web/src/Heat.test.tsx` (modify)

Contract (web/src/Heat.tsx):

```tsx
// añade al estado del bloque:
const [revision, setRevision] = useState(0)   // entra en las deps del useEffect de carga
const [saveError, setSaveError] = useState<ApiErrorCode | null>(null)
// y el handler del selector:
async function chooseMainFolder(mainFolder: string): Promise<void>
```

`chooseMainFolder` llama `saveMainFolder(repoId, mainFolder)`, y al resolver hace
`setPath(undefined)` y `setRevision((n) => n + 1)`: el `path` vuelve a `undefined` para que el
server reancle el nivel en la carpeta nueva, y `revision` fuerza la recarga también cuando
`path` ya era `undefined`. Si rechaza, guarda el `code` en `saveError` y NO cambia el nivel: lo
guardado manda, y lo que se dibuja tiene que seguir siendo lo que el server tiene.

El control, bajo el breadcrumb: una etiqueta `carpeta principal` a 13px con
`letter-spacing: .22em`, `text-transform: uppercase` en `--color-neutral-600`, y a su lado un
`<select aria-label="Carpeta principal">` de fondo transparente, sin borde salvo
`border-bottom: 1px solid var(--color-text)`, a 16px, con `value={heat.mainFolder}` y una
`<option>` por cada entrada de `mainFolderOptions(heat.mainFolder, heat.path, heat.children)`,
etiquetada con `mainFolderLabel(value)`. Si `heat.fallback` es `true`, encima del control una
línea a 16px en `--color-accent-2-700` con `fallbackNotice(heat.mainFolder)`. Si `saveError` no
es `null`, `<p role="alert">No se ha podido guardar la carpeta principal ({code}).</p>`.

**TDD:** `test('choosing another main folder rescopes the percentages and is remembered')` — el
doble de `fetch` guarda el `mainFolder` del `PUT` y lo devuelve en los `GET /heat` siguientes
con otros `percent`; se dispara `fireEvent.change` del `<select>` a `src/checkout`, se afirma
que el `PUT` llevó `{"mainFolder":"src/checkout"}`, que las filas pasan a los `percent` nuevos y
que el `GET` posterior fue **sin** `path` (el nivel se reancla); después se remonta el bloque
desde cero y se afirma que el `<select>` sigue en `src/checkout` — el «se recuerda al reabrir»
del AC, que lo cumple el server, no la UI.

**Tests:** añadidos: 'choosing another main folder rescopes the percentages and is remembered',
'a fallback says the saved folder is gone and which one is used',
'a rejected save keeps the level and reports its code'.

**Verification:** el AC de la carpeta principal queda pineado de punta a punta.

```bash
npm test -w web   # expected: exit 0 — los 4 tests nuevos de Heat.test.tsx en verde
npm run build     # expected: exit 0
npm run lint      # expected: exit 0
```

## 8. Global verification

Con las siete tareas commiteadas, desde la raíz del worktree:

```bash
npm run build                                     # expected: exit 0 — typecheck de server/ y web/ + vite build
npm test                                          # expected: exit 0 — Vitest de los dos workspaces
npm run lint                                      # expected: exit 0 — ESLint sobre todo el repo
test -z "$(git status --porcelain)"               # expected: exit 0 — nada sin commitear
test "$(git diff main --stat -- server/ web/src/tokens.css | wc -l)" -eq 0   # expected: exit 0 — ni server/ ni los tokens de marca se han tocado
```

Y a mano, para el gate humano `visual`: `npm run dev -w server` y `npm run dev -w web`, abrir
`http://127.0.0.1:5173`, y capturar el antes (`main`) y el después (`feat/6`) de la pantalla
principal del dashboard, con el drill-down bajado a un nivel de ficheros y el selector de
carpeta principal cambiado. Ese gate NO lo cierra el agente.

## 9. Assumptions

1. **«El drill-down baja hasta fichero» = el último nivel enseña ficheros, no que se pueda
   pinchar uno.** En la maqueta el `go` de un fichero es `() => {}` y el server no devuelve
   hijos de un fichero. Provenencia: `docs/design/repo-pulse-mockup.html` + `server/src/analysis/heat.ts`.
2. **El breadcrumb arranca en la carpeta principal, no en la raíz del clon.** Con
   `mainFolder = 'src'`, la API no lista los hijos de la raíz (`heatTree` devuelve
   `children: []` cuando el nivel queda fuera de la carpeta principal), así que un crumb por
   encima sería un botón muerto. Con `mainFolder = ''` el primer crumb es el nombre del repo,
   como en la maqueta. Provenencia: `server/src/analysis/heat.ts` + maqueta.
3. **El selector ofrece lo que se ve.** La API del #4 no tiene ningún endpoint de listado de
   directorios independiente de la carpeta principal, y añadirlo sería tocar `server/`, que
   está fuera de este slice. Para llegar a una carpeta que no está en el nivel actual se pasa
   por `todo el repo` y se baja. Provenencia: propia, sobre el contrato del #4.
4. **Los % se leen del payload, no se recalculan.** `HeatEntry.percent` ya viene redondeado a
   entero, así que se pinta `` `${percent}%` `` y se renuncia al decimal que la maqueta enseña
   por debajo del 10%: recalcularlo en la UI duplicaría el denominador del AC. Provenencia:
   propia, sobre `server/src/analysis/heat.ts`.
5. **El pie del Calor cambia de texto.** «el % es sobre el total del repo, no sobre la carpeta»
   de la maqueta sería falso aquí: el denominador es `mainFolderCommits`. Provenencia: contexto
   del epic («la carpeta principal acota SOLO el Calor y sus %»).
6. **«Se recuerda al reabrir el repo» lo cumple el server.** El `mainFolder` viaja en el
   `GET /heat` y ya está persistido en el JSON de datos del server; la UI no guarda nada por su
   cuenta. Provenencia: contexto del epic + `server/src/settings.ts`.
7. **Gente no hace peticiones nuevas.** `buckets[].authors` y `concentration` ya vienen en el
   `Summary` que `App` carga. Provenencia: `web/src/api/types.ts`.
8. **La sección «Contexto heredado» del issue está vacía**, así que no hay nada que heredar más
   allá del código ya mergeado; no se ha buscado fuera del issue.
