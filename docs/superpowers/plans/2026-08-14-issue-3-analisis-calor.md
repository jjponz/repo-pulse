# #3 — calor: heatTree y el % sobre la principal

> **This plan is written to be executed by task-scoped subagents with zero context.**

## 1. Context and goal

`analysis/` tiene el walker de #2 y nada de Calor.

### Desired end state

`heatTree` da los hijos de un nivel con sus commits de la ventana y su %; `src/` por defecto
si está en HEAD; un rename es path nuevo.

### Out of scope

🚫 Ni Express ni UI (`app.ts`, `index.ts`, `web/`). Ni persistencia ni caché: van con la API.
Sin BD no hay migración; se revierte y ya.

## 2. Closed decisions (do NOT reopen)

| Decision | Value |
|---|---|
| Métrica | commits distintos de la ventana que tocan ≥1 fichero bajo el hijo; `esRuido` filtra antes |
| % | sobre los de la principal; `round(c / total * 100)`, 0 si total es 0 |
| Principal | `''` = raíz; auto = `src` si está en HEAD; una guardada muerta cae a la auto (`fallback: true`) |
| Nivel | `ruta` desde la raíz del clon; fuera de la principal → `hijos: []`; orden: commits desc, luego nombre |
| Resto | la ventana es la rejilla de `walkHistory`; todo vive en `calor.ts` y `index.ts` reexporta |

## 3. Reference patterns

`agregado.ts` e `index.test.ts`.

## 4. Inventory

| File | Action | Consumed by | Block in §7 |
|---|---|---|---|
| `repo-fixture.ts` | modify | tests | Contract |
| `git.ts` | modify | `calor.ts` | Contract |
| `calor.ts` | create | `index.ts` | Contract |
| `index.ts` | modify | API #4 | prose |

## 5. Interfaces

Consumes (#2): `leerHistorial`, `esRuido`, `rejilla`, `indiceCubo`.
Produces: `heatTree`, `leerDirectorios`, `Calor`, `EntradaCalor`. La API solo crece.

## 6. Test strategy

Fixtures en `calor.test.ts` con `ahora` fijo.

## 7. Tasks

### Task 1 — el Calor

**Objective:** `heatTree` da el nivel de calor de un repo en una ventana.

**Files:** `repo-fixture.ts`, `git.ts`, `index.ts` (modify); `calor.ts` (create)

Contract (server/src/testing/repo-fixture.ts):

```ts
renombra?: { de: string; a: string }  // en CommitFixture: git mv de→a antes de `ficheros`, que puede ir vacía
```

Contract (server/src/analysis/git.ts):

```ts
export async function leerDirectorios(repo: string): Promise<string[]>  // ls-tree -d -r --name-only -z HEAD; [] sin HEAD
```

Contract (server/src/analysis/calor.ts):

```ts
export interface EntradaCalor { nombre: string; tipo: 'dir' | 'fichero'; commits: number; porcentaje: number }
export interface Calor { carpetaPrincipal: string; fallback: boolean; ruta: string; commits: number; hijos: EntradaCalor[] }
export function heatTree(repo: string, ventana: Ventana, op?: { carpetaPrincipal?: string; ruta?: string; ahora?: Date }): Promise<Calor>
```

**TDD:** `test('el % de cada hijo es sobre el total de la principal')` — 4 commits bajo `src` y
6 fuera: el hijo tocado por 1 da 25, no 10.

**Tests:** ese, `'package-lock.json no sale ni en el árbol ni en el KPI'`, `'la principal es src/
si existe y la raíz si no'`, `'una guardada muerta cae a la auto'`, `'un renombrado es path
nuevo'` y `'los hijos van por commits, luego por nombre'` en `calor.test.ts`; `'leerDirectorios
da directorios, no ficheros'` en `git.test.ts`; `'un rename nombra el viejo y el nuevo'` en
`repo-fixture.test.ts`.

**Verification:** `npm test -w server`, exit 0.

## 8. Global verification

`npm run build && npm test && npm run lint`, exit 0 (baseline 59 tests).

## 9. Assumptions

1. `ruta` va desde la raíz del clon, como el `?path=` del spec — issue.
2. El árbol usa los paths del historial sin cruzarlos con HEAD — propia.
