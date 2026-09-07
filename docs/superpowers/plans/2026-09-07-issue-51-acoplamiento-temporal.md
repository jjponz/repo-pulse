# #51 — acoplamiento temporal dentro de Calor

> **This plan is written to be executed by task-scoped subagents that arrive with zero context
> and decide nothing.** Every task carries the current state of what it touches (copied
> verbatim), the contracts it honours and the exact commands that verify it; its bodies are
> yours to write, test-first. Names, signatures, constants and test names come from this
> document, which decided them. On ambiguity, the issue body and AGENTS.md win.

## 1. Context and goal

Calor already answers "where does it burn": `server/src/analysis/heat.ts` (`heatTree`) walks the
non-merge history of a window and lists, for the level `path` the UI is looking at, how many of
that level's commits touch each immediate child (`HeatEntry`), as a percent over the main
folder's total. `web/src/Heat.tsx` (`HeatBlock`) owns that level as its own `path` state, fetches
`/api/repos/:id/heat` on every change of `repoId`/`window`/`path`, and draws a breadcrumb, a
drill-down list and a main-folder picker over it.

This issue asks for a second question at that SAME level: which pairs of children change together
in the same commits, and how strongly (Adam Tornhill's "logical coupling"). Not a new screen and
not a new navigation — AC1 anchors it "dentro de Calor, en el mismo nivel que estoy viendo", and
"Out of scope" rules out a coupling-specific drill-down. So the block reuses whatever level Heat
already resolved (`heat.path`, `heat.mainFolder`) and the same window, and answers with pairs of
that level's children, their co-change count and their coupling percent (the ratio against
whichever of the two changes least), filtered by a minimum co-change count that the screen shows.

### Desired end state

- `server/src/analysis/coupling.ts` exports `AnalyzeCoupling`, a class whose `run` reads the same
  window/main-folder/path scope as `heatTree` and answers the coupled pairs of that level's
  children, each with its co-change count and percent.
- `GET /api/repos/:id/coupling?window=&path=` answers that payload, cached by HEAD sha exactly
  like `/heat`, with no author name or email anywhere in it.
- `HeatBlock` fetches coupling right after heat resolves a level, at `heat.path`, and draws an
  "Acoplamiento" section below the existing rows: one row per pair above the minimum, sorted from
  most to least coupled, and a clear message (naming the minimum) when the window has none.
- Changing the window, or drilling into another folder, recomputes coupling exactly like Calor's
  existing heat.

### Out of scope

Taken verbatim from the issue's "Fuera de alcance": acoplamiento entre repos distintos; hotspots
por complejidad; la evolución del acoplamiento en el tiempo; cambiar nada de Pulso o Gente; una
navegación distinta de la que ya tiene Calor.

## 2. Closed decisions (take as given)

| Decision | Value |
|---|---|
| Coupling percent formula | `round(coChanges / min(countA, countB) * 100)` — Tornhill's degree of coupling: of the commits touching whichever child changes least, how many also touch the other. |
| Minimum co-changes to count (AC3) | `MIN_CO_OCCURRENCES = 5`, exported by `coupling.ts` and echoed in the payload as `minCoOccurrences` so the UI can say why a pair does not show. |
| Scope of a pair | Immediate children of the SAME `path` `heatTree` resolves (mainFolder-relative), over the SAME window — never a different level, never across the whole repo. |
| New endpoint | `GET /api/repos/:id/coupling`, same query shape (`window`, `path`) and same HEAD-sha cache as `/heat` (`server/src/api/routes.ts`). |
| Sort order (AC1, "de mayor a menor") | `percent` descending; ties by `coChanges` descending; remaining ties by `a` ascending (UTF-16, like `heat.ts`'s own tie-break). |
| Row cap in the UI | `COUPLING_ROW_LIMIT = 8`, its own constant in `web/src/heat-rows.ts` (not reused from `HEAT_ROW_LIMIT`: two independent product decisions that happen to share a value today). |
| Shape of the new server module | A class, `AnalyzeCoupling`, with its git-reading dependencies injected through the constructor by name — required by ct's `conventions/style.md` and `conventions/architecture.md` for a module born today (see §3). |
| Where the child/main-folder decisions live | Reused from `server/src/analysis/heat.ts` via new exports (`touchedChildren`, `resolveMainFolder`, `normalizePath`, `isWithin`, `countTouching`) — never re-derived in `coupling.ts` (ct's `conventions/decisions.md`). |

## 3. Reference patterns

Files to imitate: `server/src/analysis/heat.ts` (`heatTree` — main-folder resolution, window
filtering, path-scoped children: the exact decisions this slice reuses by import instead of
re-deriving), `server/src/api/routes.ts` (the heat route and its `heats` cache — the shape the
new coupling route copies), `web/src/heat-rows.ts` (`heatRows` — the bar-width math the new
`couplingRows` copies), `web/src/Heat.tsx` (the block this slice extends in place), `web/src/Heat.test.tsx`
(`stubHeat` — the fetch double this slice extends to also answer the coupling endpoint).

Rules to obey:
- `AGENTS.md` — English-only identifiers (comments, test names, error messages included) with a
  boy-scout rename of anything Spanish touched in passing; UI copy and product vocabulary (Pulso,
  Gente, Calor) stay in Spanish; no author name or email leaves `server/src/analysis/`; `.js`
  suffix on relative imports in `server/`, none in `web/`; `web/` never imports from `server/`.
- ct's own yardstick, which takes precedence over `AGENTS.md` rule by rule (see the header this
  plan was dispatched with) — read from the plugin's own path, absolute because it lives outside
  this repo:
  - `/Users/pdiazsa/Mercadona/code/others/control-tower-plugin/plugin/conventions/style.md` —
    binds every diff. The declared-debt exemption (keep the host file's existing style) covers
    every file this slice only MODIFIES (`heat.ts`, `index.ts`, `app.ts`, `routes.ts`,
    `client.ts`, `types.ts`, `heat-rows.ts`, `format.ts`, `Heat.tsx`: all pre-date this document
    and stay free-function/commented where they already are). It does NOT cover the new
    coupling module (Task 2), created by this slice: no comments or docstrings
    there, and every function hangs off a type (`AnalyzeCoupling`, not a free `couplingOf` inside
    that file — the free function of that name lives in the OLD, exempt `index.ts` barrel).
  - `/Users/pdiazsa/Mercadona/code/others/control-tower-plugin/plugin/conventions/architecture.md`
    — binds new modules only, so it reaches the new coupling module (Task 2) and nothing else this
    slice touches. What it asks for there: one concept per module (`Coupling`, `CouplingPair`,
    `CouplingScope`, `AnalyzeCoupling` all share a life with `Coupling` and stay in one file);
    `AnalyzeCoupling`'s two git-reading dependencies enter through its constructor, by name; its
    `run` takes one params object (`CouplingScope`) and returns one result object (`Coupling`),
    both declared beside it, no suffix.
  - `/Users/pdiazsa/Mercadona/code/others/control-tower-plugin/plugin/conventions/defects.md` —
    binds every diff, no exemption: closed vocabulary over booleans (`aKind`/`bKind` stay
    `'dir' | 'file'`, matching `HeatEntry.kind`), no raw map as the coupling result, no sentinel
    standing in for an absence the type could carry.
  - `/Users/pdiazsa/Mercadona/code/others/control-tower-plugin/plugin/conventions/decisions.md` —
    binds every diff: the main-folder/child-of-path decision is written once, in `heat.ts`; this
    slice reuses it by import (Task 1) instead of writing a second version in `coupling.ts`.
  - `/Users/pdiazsa/Mercadona/code/others/control-tower-plugin/plugin/conventions/testing.md` —
    binds every diff: test names are the sentence, the coupling threshold is pinned at its
    boundary (exactly the minimum, and one below), and `stubHeat`'s extension answers by URL, not
    by call order.

## 4. Inventory

| File | Action | Consumed by | Block in §7 |
|---|---|---|---|
| `server/src/analysis/heat.ts` | modify | `coupling.ts` | Current state |
| `server/src/analysis/coupling.ts` | create | `index.ts` | Contract |
| `server/src/analysis/coupling.test.ts` | create | — | none (test named in Task 2) |
| `server/src/analysis/index.ts` | modify | `app.ts`, `routes.ts` | Current state / Contract |
| `server/src/app.ts` | modify | `routes.ts` | Current state |
| `server/src/api/routes.ts` | modify | `web/src/api/client.ts` | Current state / Call site |
| `server/src/api/routes.test.ts` | modify | — | none |
| `web/src/api/types.ts` | modify | `client.ts`, `Heat.tsx` | Current state / Contract |
| `web/src/api/client.ts` | modify | `Heat.tsx` | Current state / Contract |
| `web/src/api/client.test.ts` | modify | — | none |
| `web/src/heat-rows.ts` | modify | `Heat.tsx` | Current state / Contract |
| `web/src/heat-rows.test.ts` | modify | — | none |
| `web/src/format.ts` | modify | `Heat.tsx` | Current state / Contract |
| `web/src/format.test.ts` | modify | — | none |
| `web/src/Heat.tsx` | modify | (top-level, `App.tsx` unchanged) | Current state / Call site |
| `web/src/Heat.test.tsx` | modify | — | none |

## 5. Interfaces

Consumes: N/A — the issue's "Contexto del epic" is empty (no Jira story) and "Dependencias" is
not present; nothing to consume from another slice.

Produces:
- `server/src/analysis/coupling.ts`: `class AnalyzeCoupling` with `run(scope: CouplingScope): Promise<Coupling>`;
  types `CouplingScope`, `CouplingPair`, `Coupling`; constant `MIN_CO_OCCURRENCES`.
- `server/src/analysis/heat.ts` (new exports): `touchedChildren(commits, path)`, `resolveMainFolder`,
  `normalizePath`, `isWithin`, `countTouching`.
- `server/src/analysis/index.ts`: `couplingOf(repo: string, window: TimeWindow, opts?: { mainFolder?: string; path?: string; now?: Date }): Promise<Coupling>`,
  re-exporting `Coupling`, `CouplingPair`, `CouplingScope`, `AnalyzeCoupling`, `MIN_CO_OCCURRENCES`.
- `GET /api/repos/:id/coupling?window=&path=` — new HTTP endpoint, same envelope and cache shape
  as `/heat`.
- `web/src/api/client.ts`: `fetchCoupling(id: string, window: TimeWindow, path?: string, signal?: AbortSignal): Promise<Coupling>`.
- `web/src/heat-rows.ts`: `couplingRows(pairs: readonly CouplingPair[]): CouplingRow[]`, constant `COUPLING_ROW_LIMIT`.
- `web/src/format.ts`: `noCouplingHeadline(minCoOccurrences: number): string`, `couplingFooter(pairs: number, minCoOccurrences: number): string`.

## 6. Test strategy

Server: Vitest against real throwaway git repos via `server/src/testing/repo-fixture.ts`
(`createRepoFixture`), exactly like `heat.test.ts` and `index.test.ts` — no mocked git. The
threshold (`MIN_CO_OCCURRENCES`) is pinned at its boundary: a pair with exactly 5 shared commits
appears, one with 4 does not. `routes.test.ts` extends its existing spy-over-the-real-barrel
pattern (`spiesOverAnalysis`) with `couplingOf`, so the cache tests stay integration tests against
real git, not mocks.

Web: Vitest + Testing Library. Pure modules (`heat-rows.ts`, `format.ts`) get plain unit tests, no
DOM. `client.test.ts` doubles `fetch` and asserts the request shape, like its `fetchHeat` tests.
`Heat.test.tsx` extends `stubHeat` to answer `/coupling` by URL (never by call order, per
`conventions/testing.md`) and renders through Testing Library, like every existing test there.

Every task carries its own tests; no task in this slice is test-free.

## 7. Tasks

### Task 1 — Export heat's tree-walking decisions for reuse

**Objective:** `heat.ts` exposes the main-folder, path and per-commit child decisions coupling
needs, without duplicating any of them.

**Files:** `server/src/analysis/heat.ts` (modify)

Current state (server/src/analysis/heat.ts, line 72):

```
function normalizePath(path: string | undefined): string | undefined {
```

Current state (server/src/analysis/heat.ts, line 77):

```
function isWithin(mainFolder: string, path: string): boolean {
```

Current state (server/src/analysis/heat.ts, lines 81-84):

```
function resolveMainFolder(
  directories: readonly string[],
  saved: string | undefined,
): { mainFolder: string; fallback: boolean } {
```

Current state (server/src/analysis/heat.ts, line 94):

```
function countTouching(commits: readonly Commit[], path: string): number {
```

Current state (server/src/analysis/heat.ts, lines 106-117):

```
    const touched = new Map<string, 'dir' | 'file'>()
    for (const file of commit.files) {
      if (isNoise(file)) continue
      const child = childOf(path, file)
      if (child === null) continue
      if (touched.get(child.name) !== 'dir') touched.set(child.name, child.kind)
    }
    for (const [name, kind] of touched) {
      const entry = byName.get(name) ?? { kind, commits: new Set<string>() }
      if (kind === 'dir') entry.kind = 'dir'
      entry.commits.add(commit.sha)
      byName.set(name, entry)
```

Contract (server/src/analysis/heat.ts):

```
export function touchedChildren(
  commits: readonly Commit[],
  path: string,
): Map<string, { kind: 'dir' | 'file'; commits: Set<string> }>
```

Add `export` to `normalizePath`, `isWithin`, `resolveMainFolder` and `countTouching` (their bodies
do not change). Extract the cited loop (lines 106-117) into the new exported `touchedChildren`,
keeping the same `for (const commit of commits)` wrapper and returning the `byName` map it builds;
`childrenOf` calls `touchedChildren(commits, path)` and keeps only the percent/sort math that
follows it today.

**TDD:** No TDD — pure refactor, no new behaviour: `heat.test.ts` already pins `heatTree`'s output
through `childrenOf`, and it must stay green unchanged.

**Tests:** N/A — no test added or removed; `heat.test.ts` is the existing lock on this behaviour.

**Verification:** the refactor changes no observable output of `heatTree`.

```bash
npm test -w server   # expected: exit 0 — heat.test.ts stays green with no changes to it
npm run build        # expected: exit 0 — tsc accepts the new exports
```

### Task 2 — Create the coupling analysis module

**Objective:** a new module computes, for one level, the pairs of children that co-change above
the minimum, with their co-change count and percent.

**Files:** `server/src/analysis/coupling.ts` (create), `server/src/analysis/coupling.test.ts` (create)

Contract (server/src/analysis/coupling.ts):

```
export const MIN_CO_OCCURRENCES = 5
export interface CouplingPair { a: string; aKind: 'dir' | 'file'; b: string; bKind: 'dir' | 'file'; coChanges: number; percent: number }
export interface CouplingScope { repo: string; window: TimeWindow; mainFolder?: string; path?: string; now?: Date }
export interface Coupling {
  mainFolder: string
  fallback: boolean
  path: string
  commits: number
  minCoOccurrences: number
  headSha: string | null
  pairs: readonly CouplingPair[]
}
export class AnalyzeCoupling {
  constructor(
    private readonly readDirectories: (repo: string) => Promise<string[]>,
    private readonly readHistory: (repo: string) => Promise<{ headSha: string | null; commits: Commit[] }>,
  ) {}
  run(scope: CouplingScope): Promise<Coupling>
}
```

`run` mirrors `heatTree`'s own steps, calling the Task 1 exports instead of re-deriving them:
resolve `mainFolder` (`resolveMainFolder` + `normalizePath`) and `path` (`normalizePath(scope.path) ?? mainFolder.mainFolder`);
filter commits to the window with `buildGrid`/`bucketIndex` (`./windows.js`); `commits` is
`countTouching(inWindow, path)`; when `isWithin(mainFolder.mainFolder, path)`, take
`touchedChildren(inWindow, path)` and, for every unique pair of its keys ordered `a < b`
(UTF-16), compute `coChanges` as the size of the intersection of their two commit sets, keep it
only when `coChanges >= MIN_CO_OCCURRENCES`, and set `percent` to
`round(coChanges / min(sizeA, sizeB) * 100)`; sort by the rule in §2. No comments: name things so
the rule reads without one, per `conventions/style.md`.

**TDD:** red first —
`it('a pair with exactly the minimum co-occurrences appears and one fewer does not')`: two files
under the same folder, one sharing exactly 5 commits with a third file and 4 with a fourth;
`run(...)` must return the first pair and omit the second.

**Tests:** added —
`it('a pair with exactly the minimum co-occurrences appears and one fewer does not')`,
`it('the percent is over whichever child changes least, not over the total')`,
`it('commits outside the window do not count towards coupling')`,
`it('the coupling payload carries no author email or name')`.

**Verification:** the four tests above pass and the module builds.

```bash
npm test -w server   # expected: exit 0 — the four coupling.test.ts assertions above in green
npm run build        # expected: exit 0
```

### Task 3 — Wire coupling into the analysis barrel

**Objective:** the barrel exposes a `couplingOf(repo, window, opts)` entry point, matching
`heatTree`'s own calling convention.

**Files:** `server/src/analysis/index.ts` (modify)

Current state (server/src/analysis/index.ts, lines 34-35):

```
export { heatTree } from './heat.js'
export type { Heat, HeatEntry } from './heat.js'
```

Contract (server/src/analysis/index.ts):

```
export function couplingOf(
  repo: string,
  window: TimeWindow,
  opts?: { mainFolder?: string; path?: string; now?: Date },
): Promise<Coupling>
export { AnalyzeCoupling, MIN_CO_OCCURRENCES } from './coupling.js'
export type { Coupling, CouplingPair, CouplingScope } from './coupling.js'
```

`couplingOf`'s body is `new AnalyzeCoupling(readDirectories, readHistory).run({ repo, window, ...opts })`
(both already imported in this file for `heatTree`/`walkHistory`).

**TDD:** red first — `it('couplingOf delegates to AnalyzeCoupling and resolves to its result')`,
asserting against a real fixture (not a double, per `conventions/testing.md`): a repo with a
coupled pair above the minimum, `couplingOf(fixture.path, '12m', { now: NOW })` returns it.

**Tests:** added — `it('couplingOf delegates to AnalyzeCoupling and resolves to its result')`.

**Verification:** the barrel re-exports resolve and the new test passes.

```bash
npm test -w server   # expected: exit 0 — the new index.test.ts assertion in green
npm run build        # expected: exit 0
```

### Task 4 — Expose coupling through the API

**Objective:** `GET /api/repos/:id/coupling` answers the same envelope and HEAD-sha cache as
`/heat`.

**Files:** `server/src/app.ts` (modify), `server/src/api/routes.ts` (modify), `server/src/api/routes.test.ts` (modify)

Current state (server/src/app.ts, lines 20-23):

```
export type AnalysisPort = Pick<
  typeof analysis,
  'readHeadSha' | 'readLastCommitAt' | 'walkHistory' | 'heatTree'
>
```

`'heatTree'` becomes `'heatTree' | 'couplingOf'` in that `Pick`.

Current state (server/src/api/routes.ts, lines 30-31):

```
  const summaries = createCache<Analysis>(CACHE_LIMIT)
  const heats = createCache<Heat>(CACHE_LIMIT)
```

Current state (server/src/api/routes.ts, lines 77-80):

```
    response.json({ window, ...heat })
  })

  router.put('/repos/:id/settings', async (request, response) => {
```

Call site (server/src/api/routes.ts):

```
const couplings = createCache<Coupling>(CACHE_LIMIT)
router.get('/repos/:id/coupling', async (request, response) => {
  const coupling = await couplings.remember(
    keyOf([repo, window, headSha, dayOf(now), mainFolder, path]),
    () => deps.analysis.couplingOf(repo, window, { mainFolder, path, now }),
    (value) => value.headSha === headSha,
  )
  response.json({ window, ...coupling })
})
```

The new route reads `repo`, `window`, `mainFolder`, `path`, `now` and `headSha` exactly like the
`/heat` handler above it (same `resolveRepo`/`windowOf`/`pathOf`/`deps.settings.mainFolderOf`
calls), inserted between the `/heat` route and `/repos/:id/settings`.

**TDD:** red first — `it('answers the coupling of the level asked for, cached by HEAD sha')`,
extending `spiesOverAnalysis` with `couplingOf: vi.fn(analysis.couplingOf)` and asserting a second
request with the same HEAD does not call it again (same pattern as the existing heat cache test).

**Tests:** added — `it('answers the coupling of the level asked for, cached by HEAD sha')`.

**Verification:** the route answers and the cache spy proves a single real call.

```bash
npm test -w server   # expected: exit 0 — the new routes.test.ts assertion in green
npm run build        # expected: exit 0
npm run lint         # expected: exit 0
```

### Task 5 — Web contracts and client for coupling

**Objective:** `web/` declares the `Coupling`/`CouplingPair` payload on its own (never imported
from `server/`) and fetches it.

**Files:** `web/src/api/types.ts` (modify), `web/src/api/client.ts` (modify), `web/src/api/client.test.ts` (modify)

Current state (web/src/api/types.ts, lines 100-102):

```
}

export const WINDOWS: readonly TimeWindow[] = ['30d', '90d', '12m', 'all']
```

Contract (web/src/api/types.ts):

```
export interface CouplingPair {
  a: string
  aKind: 'dir' | 'file'
  b: string
  bKind: 'dir' | 'file'
  coChanges: number
  percent: number
}
export interface Coupling {
  mainFolder: string
  fallback: boolean
  path: string
  commits: number
  minCoOccurrences: number
  headSha: string | null
  pairs: CouplingPair[]
}
```

Current state (web/src/api/client.ts, lines 47-50):

```
}

export async function saveMainFolder(
  id: string,
```

Contract (web/src/api/client.ts):

```
export function fetchCoupling(
  id: string,
  window: TimeWindow,
  path?: string,
  signal?: AbortSignal,
): Promise<Coupling>
```

`fetchCoupling`'s body mirrors `fetchHeat`'s exactly, hitting `/api/repos/:id/coupling` with the
same `path` and `window` query rule (empty string when `path === ''`, omitted when `undefined`).

**TDD:** red first — `it('asks the coupling for the level it is given')`, asserting the request
URL is `/api/repos/alpha/coupling?window=90d&path=src/ui` (same shape as the existing
`'asks the heat for the level it is given'` test).

**Tests:** added — `it('asks the coupling for the level it is given')`.

**Verification:** the client test passes and the types build.

```bash
npm test -w web   # expected: exit 0 — the new client.test.ts assertion in green
npm run build     # expected: exit 0
```

### Task 6 — Pure coupling rows and copy

**Objective:** the row shaping (bar width) and the Spanish copy for the empty/footer states exist
as pure, tested functions, like `heatRows` and `heatFooter`.

**Files:** `web/src/heat-rows.ts` (modify), `web/src/heat-rows.test.ts` (modify), `web/src/format.ts` (modify), `web/src/format.test.ts` (modify)

Current state (web/src/heat-rows.ts, lines 62-64):

```
  }
  return [...new Set(options)]
}
```

Contract (web/src/heat-rows.ts):

```
export const COUPLING_ROW_LIMIT = 8
export interface CouplingRow extends CouplingPair {
  barWidth: string
}
export function couplingRows(pairs: readonly CouplingPair[]): CouplingRow[]
```

`couplingRows` takes the top `COUPLING_ROW_LIMIT` pairs (already sorted by the API, per §2) and
computes `barWidth` exactly like `heatRows` does over `percent`, relative to the first pair's
`percent`.

Current state (web/src/format.ts, lines 141-142):

```
export function fallbackNotice(mainFolder: string): string {
  return `La carpeta principal guardada ya no existe en HEAD: el calor se acota a ${mainFolderLabel(mainFolder)}.`
```

Contract (web/src/format.ts):

```
export function noCouplingHeadline(minCoOccurrences: number): string
export function couplingFooter(pairs: number, minCoOccurrences: number): string
```

`noCouplingHeadline(5)` → `'Ninguna pareja llega a 5 cambios juntos en esta ventana'`.
`couplingFooter(3, 5)` → `'3 parejas · mínimo 5 cambios juntos para contar'`; `couplingFooter(1, 5)`
→ `'1 pareja · mínimo 5 cambios juntos para contar'`.

**TDD:** red first — `it('the bar of the most coupled pair fills the level like heatRows')` (over
`couplingRows`), and `it('the empty and footer copy name the minimum')` (over the two `format.ts`
functions with the exact strings above).

**Tests:** added — `it('the bar of the most coupled pair fills the level like heatRows')`,
`it('at most COUPLING_ROW_LIMIT rows are drawn')`, `it('the empty and footer copy name the minimum')`.

**Verification:** the new pure-module tests pass and neither file imports React or `fetch`.

```bash
npm test -w web                                                            # expected: exit 0 — new tests in green
test "$(grep -cE "from 'react'|fetch\(" web/src/heat-rows.ts)" -eq 0        # expected: exit 0 — module stays pure
npm run build                                                               # expected: exit 0
```

### Task 7 — Fetch coupling alongside heat

**Objective:** `HeatBlock` asks for coupling at the exact level heat just resolved, every time
that level changes.

**Files:** `web/src/Heat.tsx` (modify), `web/src/Heat.test.tsx` (modify)

Add `fetchCoupling`/`Coupling` to the existing `fetchHeat`/`Heat` import lines at the top of the
file (line 2 and line 3), and the two new `useState` hooks below (right next to the existing
`path`/`heat`/`error`/`revision`/`saveError` ones, lines 22-28).

Current state (web/src/Heat.tsx, lines 50-56):

```
  }, [repoId, window, path, revision])

  /**
   * Saves the folder and only then moves: the level goes back to "none asked
   * for" so the server re-anchors it inside the new folder. A rejected save
   * leaves both the level and the drawing alone — what is saved rules.
   */
```

Call site (web/src/Heat.tsx):

```
const [coupling, setCoupling] = useState<Coupling | null>(null)
const [couplingError, setCouplingError] = useState<ApiErrorCode | null>(null)
useEffect(() => {
  if (heat === null) return
  const controller = new AbortController()
  setCoupling(null)
  setCouplingError(null)
  void loadCoupling(controller.signal)
  return () => controller.abort()
}, [repoId, window, heat?.path])
```

Import `fetchCoupling` and `Coupling` alongside the existing `fetchHeat`/`Heat` imports. The new
effect's inner `loadCoupling` mirrors `loadHeat` above it: calls
`fetchCoupling(repoId, window, heat.path, signal)`, guards on `signal.aborted`, and sets
`coupling`/`couplingError` through `codeOf` like every other load in this file.

`stubHeat` in `Heat.test.tsx` (its double, cited below) must branch on the URL's pathname: a
`/coupling` request answers a default empty `Coupling` (`pairs: []`, `minCoOccurrences: 5`,
`mainFolder`/`fallback`/`path`/`headSha` matching the `Heat` the same test double already answers
for that level) unless the test overrides it — answered by what is asked, never by call order,
per `conventions/testing.md`.

Current state (web/src/Heat.test.tsx, lines 48-59):

```
function stubHeat(tree: Record<string, readonly HeatEntry[]>): { urls: string[] } {
  const urls: string[] = []
  vi.stubGlobal('fetch', (url: string) => {
    urls.push(url)
    const path = pathOf(url) ?? MAIN_FOLDER
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(levelOf(path, tree[path] ?? [])),
    } as unknown as Response)
  })
  return { urls }
}
```

**TDD:** red first —
`it('asks coupling for the same level heat is showing')`: after drilling down to
`'src/checkout'`, `urls` contains a `/api/repos/alpha/coupling?window=12m&path=src%2Fcheckout`
request.

**Tests:** added — `it('asks coupling for the same level heat is showing')`.

**Verification:** the new request is observed and every existing `Heat.test.tsx` test stays green
with the extended double.

```bash
npm test -w web   # expected: exit 0 — the new test in green, no existing one broken
npm run build     # expected: exit 0
```

### Task 8 — Render the coupling block

**Objective:** the "Acoplamiento" section draws one row per pair above the minimum, sorted, and a
clear message when there is none.

**Files:** `web/src/Heat.tsx` (modify), `web/src/Heat.test.tsx` (modify)

Current state (web/src/Heat.tsx, lines 206-211):

```
          <div style={{ fontSize: '15px', color: 'var(--color-neutral-600)', lineHeight: 1.45 }}>
            {heatFooter(heat.children.length, heat.commits, heat.mainFolderCommits)}
            {' · el % es sobre el total de la carpeta principal.'}
          </div>
        </>
      )}
```

Call site (web/src/Heat.tsx):

```
{coupling !== null && couplingRows(coupling.pairs).length === 0 && (
  <div>{noCouplingHeadline(coupling.minCoOccurrences)}</div>
)}
{coupling !== null && couplingRows(coupling.pairs).map((row) => (
  <div key={`${row.a}|${row.b}`} data-testid="coupling-row">
    {row.a} ↔ {row.b} · {row.percent}%
  </div>
))}
```

Inserted right after the existing heat footer (cited above), under an `<h3>Acoplamiento</h3>`
heading, followed by `{couplingError !== null && <p role="alert">...</p>}` (same pattern as the
existing heat `error`) and, once `coupling !== null`, `{couplingFooter(coupling.pairs.length, coupling.minCoOccurrences)}`.
Import `couplingRows` from `./heat-rows` and `noCouplingHeadline`/`couplingFooter` from `./format`.

**TDD:** red first —
`it('draws a row per coupled pair with its percent')`: given a coupling double with two pairs,
both render with `data-testid="coupling-row"` and their `percent`, in the order the double sent
them.
`it('a level with no pair above the minimum says so instead of an empty list')`: given
`pairs: []`, the screen shows `noCouplingHeadline(5)` and no `coupling-row`.

**Tests:** added — `it('draws a row per coupled pair with its percent')`,
`it('a level with no pair above the minimum says so instead of an empty list')`.

**Verification:** both new renders pass and the whole slice is green end to end.

```bash
npm test -w web   # expected: exit 0 — the two new tests in green
npm run build     # expected: exit 0
npm run lint      # expected: exit 0
```

## 8. Global verification

End-to-end, once every task above is committed: the whole repo builds, tests and lints clean, and
nothing is left uncommitted.

```bash
npm run build                        # expected: exit 0 — typecheck of server/ and web/ + vite build
npm test                             # expected: exit 0 — Vitest of both workspaces
npm run lint                         # expected: exit 0 — ESLint over the whole repo
test -z "$(git status --porcelain)"  # expected: exit 0 — nothing left uncommitted
```

## 9. Assumptions

1. **`MIN_CO_OCCURRENCES = 5`.** The issue asks for a minimum without a number and asks that it be
   shown on screen (AC3). Provenance: my call, following the common default (≥5 shared revisions)
   for coupling signal in Tornhill's own tooling — small enough that this repo's own history (and
   the small fixtures this slice's tests use) can clear it, large enough to filter incidental
   pairs.
2. **`AnalyzeCoupling` as a constructor-injected class, not a free function.** Provenance: ct's
   `conventions/style.md` and `conventions/architecture.md` (§3), which bind `coupling.ts` because
   it is a module born today — the rest of `server/src/analysis/` is free functions, declared
   debt from before those documents existed in this repo (no plan before this one cites
   `conventions/`, confirmed against `docs/superpowers/plans/2026-08-14-issue-3-analisis-calor.md`).
3. **`COUPLING_ROW_LIMIT` as its own constant, not a reuse of `HEAT_ROW_LIMIT`.** Provenance: my
   call — "how many heat rows to draw" and "how many coupling pairs to draw" are independent
   product decisions (`conventions/decisions.md`'s test: would a change to one force touching the
   other? no), even though both start at 8.
4. **Coupling is fetched keyed on `heat.path`, not on the raw drill-down `path` state.** Provenance:
   AC1 ("en el mismo nivel que estoy viendo") and AC4 (recomputes with the window like the rest of
   Calor) — `heat.path` is the server-resolved level (it also covers the very first load, where
   `path` itself is still `undefined`), so it is the only value that is always the level actually
   on screen.
5. **UI copy (Spanish) for the new section**: heading `"Acoplamiento"`, empty state
   `noCouplingHeadline`, footer `couplingFooter`, row text `"{a} ↔ {b} · {percent}%"` — exact
   strings pinned by Task 6/8's tests. Provenance: my call, following the existing Heat block's
   register (short, direct, no author-facing jargon).
6. **Sort tie-break: `percent` desc, then `coChanges` desc, then `a` ascending.** Provenance: my
   call, extending AC1's "de mayor a menor acoplamiento" with a deterministic tie-break, mirroring
   `heat.ts`'s own tie-break rule (`entries.sort` in `childrenOf`) for the same reason (no
   locale-dependent order).
7. **No new endpoint parameter for the threshold**: the UI cannot change `MIN_CO_OCCURRENCES`; the
   issue's AC3 only asks that the number be visible, never that it be configurable.
