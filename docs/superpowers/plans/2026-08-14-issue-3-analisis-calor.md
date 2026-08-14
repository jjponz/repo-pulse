# #3 — calor: heatTree y el % sobre la principal

> **This plan is written to be executed by task-scoped subagents.**

## 1. Context and goal

`analysis/` tiene el walker de #2 y nada de Calor.

### Desired end state

`heatTree` da los hijos de un nivel con sus commits y su %; `src/` por defecto si está en
HEAD; un rename es path nuevo.

### Out of scope

🚫 Ni Express ni UI (`app.ts`, `server/src/index.ts`, `web/`). Ni caché: va con la API.
Sin BD, sin migración.

## 2. Closed decisions (do NOT reopen)

| Decision | Value |
|---|---|
| Idioma | código en inglés (AGENTS.md) |
| Ventana | con `buildGrid` + `bucketIndex`, no a mano |
| Vive en | `heat.ts` |
| Métrica | commits distintos de la ventana que tocan ≥1 fichero bajo el hijo; ruido antes |
| % | sobre `mainFolderCommits`, no sobre los del nivel; `round(c / total * 100)`, 0 si total 0 |
| Principal | `''` = raíz; auto = `src` si está en HEAD; una guardada muerta cae a la auto (`fallback: true`) |
| Nivel | `path` desde la raíz del clon; fuera de la principal → `children: []`; orden: commits, nombre |

## 3. Reference patterns

`aggregate.ts` e `index.test.ts`.

## 4. Inventory

| File | Action | Consumed by | Block in §7 |
|---|---|---|---|
| `repo-fixture.ts` | modify | tests | Contract |
| `git.ts` | modify | `heat.ts` | Contract |
| `heat.ts` | create | `index.ts` | Contract |
| `analysis/index.ts` | modify | API #4 | prose |

## 5. Interfaces

Consumes de #2 (en `main`): `readHistory`, `isNoise`, `buildGrid`, `bucketIndex`, `Commit` y
`TimeWindow`. Produces: `heatTree`, `readDirectories`, `Heat`, `HeatEntry`.

## 6. Test strategy

Fixtures con `now` fijo. AC→test en `heat.test.ts`: AC1 → `'package-lock.json is in neither
tree nor KPI'`; AC2 → `'percent is over the main folder total'`; AC3 → `'main folder defaults
to src, else root'`; AC4 → `'a renamed file is a new path'`. Más `'children sort by commits,
then name'` y `'a stale main folder falls back'`; en `git.test.ts`, `'readDirectories lists
dirs, not files'`; en `repo-fixture.test.ts`, `'a rename names both paths'`.

## 7. Tasks

### Task 1 — el Calor

**Objective:** el nivel de calor de un repo en una ventana.

**Files:** `repo-fixture.ts`, `git.ts`, `analysis/index.ts` (modify); `heat.ts` (create)

Contract (server/src/testing/repo-fixture.ts):

```ts
rename?: { from: string; to: string }  // in CommitFixture: git mv before writing `files` (may be empty)
```

Contract (server/src/analysis/git.ts):

```ts
export async function readDirectories(repo: string): Promise<string[]>  // ls-tree -d -r --name-only -z HEAD; [] if no HEAD
```

Contract (server/src/analysis/heat.ts):

```ts
export interface HeatEntry { name: string; kind: 'dir' | 'file'; commits: number; percent: number }
export interface Heat { mainFolder: string; fallback: boolean; path: string; commits: number; mainFolderCommits: number; headSha: string | null; children: HeatEntry[] }
export function heatTree(repo: string, window: TimeWindow, opts?: { mainFolder?: string; path?: string; now?: Date }): Promise<Heat>
```

**TDD:** el de AC2 (§6): 4 commits bajo `src` y 6 fuera, el hijo tocado por 1 da 25, no 10.

**Tests:** los ocho de §6.

**Verification:** `npm test -w server`, exit 0.

## 8. Global verification

`npm run build && npm test && npm run lint`, exit 0 (baseline 59).

## 9. Assumptions

1. `path` va desde la raíz del clon (`?path=` del spec); el árbol usa el historial, no HEAD —
   issue y propia.
2. El KPI del AC1 es `kpis.filesTouched` — repo.
