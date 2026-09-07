# #45 — la métrica de los campeones: cobertura de tests por clon y su bloque «Campeones»

> **This plan is written to be executed by task-scoped subagents that arrive with zero context
> and decide nothing.** Every task carries the current state of what it touches (copied
> verbatim), the contracts it honours and the exact commands that verify it; its bodies are
> yours to write, test-first. Names, signatures, constants and test names come from this
> document, which decided them. On ambiguity, the issue body and AGENTS.md win.

## 1. Context and goal

`server/` serves four endpoints from `server/src/api/routes.ts` over the clones that hang off
`REPO_PULSE_ROOT`; `server/src/repos.ts` is the catalog of those clones and `server/src/app.ts`
is the composition root that assembles `AppDeps`. Failures leave the API as
`{error: {code, message}}` through `server/src/api/errors.ts`. The UI in `web/` draws three
blocks (`web/src/Pulse.tsx`, `web/src/People.tsx`, `web/src/Heat.tsx`) over the payload types it
declares itself in `web/src/api/types.ts`.

This slice adds the test coverage of each clone as one more metric, read — never executed —
from the coverage artefacts the clone already carries, plus a new «Campeones» block that ranks
the clones by that coverage.

### Desired end state

- A new module tree `server/src/coverage/` reads the coverage of a clone from the artefacts
  already on disk: `coverage/coverage-summary.json` (istanbul), `coverage/lcov.info` and
  `lcov.info` (lcov), `coverage/coverage.xml` and `coverage.xml` (cobertura), in that order.
- The metric is the percentage of covered LINES, `covered / total` rounded to one decimal.
- A clone with no artefact reads as `no-artifact`; one whose artefact cannot be parsed reads as
  `unreadable-artifact`. Neither is ever reported as 0 %, in the payload or in the bar the block
  draws: a clone with no percentage draws NO bar, so it cannot be confused with one measured at
  0 %.
- One clone whose reading fails never sinks the reading of the others: the ranking answers every
  clone of the root, with the failed one as `unreadable-artifact`.
- `GET /api/coverage` answers every clone of the root ordered by coverage descending, with the
  clones that have no percentage last, each entry carrying `id`, `state`, `percentage`, `lines`,
  `source` and `measuredAt` (the mtime of the artefact that was read).
- The parse of an artefact is cached per clone and per artefact mtime, with the `Cache` of
  `server/src/api/routes.ts`.
- The server keeps listening on `127.0.0.1` only, `web/` keeps importing nothing from `server/`,
  and no payload carries an author name or email.
- A «Campeones» block in the dashboard draws the ranking with name, percentage, bar, source
  format and age of the measure; it highlights the clone selected in the header and it says so
  when a clone has no data, when no clone has data, and when the API fails.
- `npm run build`, `npm test` and `npm run lint` green from the root.

### Out of scope

From the issue's "Fuera de alcance (protegido)": running tests or coverage tools inside a clone;
reading coverage from CI or any external service; history or trend of the coverage; coverage per
folder or per file (that is Calor); thresholds, alerts or configurable traffic-light colours.
JaCoCo (`jacocoTestReport.xml`) is left out as well: the issue calls it desirable and
non-blocking, and the format list this plan closes has three members.

## 2. Closed decisions (take as given)

| Decision | Value |
|---|---|
| Route | `GET /api/coverage`, body `{ coverage: [...] }`, like `/repos` |
| Formats | exactly three: `istanbul`, `lcov`, `cobertura` |
| Candidate order | `coverage/coverage-summary.json`, `coverage/lcov.info`, `lcov.info`, `coverage/coverage.xml`, `coverage.xml`; the first one that yields lines wins |
| Metric | lines only: `covered / total`, rounded to one decimal |
| An artefact with no line counters | does not count: the walk continues to the next candidate |
| No candidate counts | state `no-artifact`, every value `null` |
| Artefact that is not its format | the reader raises `UnreadableArtifact`, the use case turns it into state `unreadable-artifact` |
| A read that fails for any other reason | contained in the use case as `unreadable-artifact` too, and warned about; it never travels out of the clone it belongs to |
| Order of the ranking | measured first by percentage descending, then every non-measured; ties broken by `id` ascending, compared by code unit |
| Measure date | mtime of the artefact that was read, ISO 8601 |
| Cache key | clone path, candidate path and artefact mtime |
| New server code | lives under `server/src/coverage/`, one concept per module |
| Spanish is only for UI copy | identifiers, comments, test names and diagnostics in English |

## 3. Reference patterns

Files to imitate: `server/src/api/routes.ts` (route shape and the `Cache`), `server/src/repos.ts`
(reading the filesystem with no clone ever mutated, and the code-unit name order),
`server/src/api/routes.test.ts` (integration test over `createApp(deps)` with everything in
`tmp`), `web/src/Heat.tsx` (a block that loads its own endpoint and owns its error state),
`web/src/format.ts` (the single place English payload values become Spanish copy),
`web/src/api/types.ts` (payload types declared in `web/`, never imported from `server/`).

Rules to obey: `AGENTS.md` — code always in English, Spanish only for what a person reads as
product; Vitest tests beside the code; relative imports carry the `.js` suffix in `server/` and
carry none in `web/`; author names and emails never leave the server; the server never mutates a
clone and never fetches; `web/` never imports from `server/`.

Above that repo yardstick sits ct's own, the five documents of the plugin conventions directory
whose absolute path the kickoff gave (defects, style, decisions, architecture, testing). It wins
rule by rule where the two collide. For this slice it decides: closed vocabularies instead of
loose strings and optionals, no raw map as the return value of logic, no prose in new code, every
function hanging off a type, one concept per module, domain knowing nobody, use cases receiving
their dependencies by name through the constructor, the foreign coverage formats validated by
projection at the boundary, and tests written outside-in with their names as sentences. In this
lane the architecture document applies to everything this slice adds, including what it adds to
a module that already existed and never conformed.

## 4. Inventory

| File | Action | Consumed by | Block in §7 |
|---|---|---|---|
| `server/src/coverage/line-count.ts` | create | readers, ranking, payload | Contract |
| `server/src/coverage/coverage-format.ts` | create | readers, payload | Contract |
| `server/src/coverage/coverage-reading.ts` | create | readers, use case, payload | Contract |
| `server/src/coverage/repo-coverage.ts` | create | order, use case, payload | Contract |
| `server/src/coverage/unreadable-artifact.ts` | create | readers, use case | Contract |
| `server/src/coverage/coverage-artifacts.ts` | create | use case, adapter | Contract |
| `server/src/coverage/coverage-order.ts` | create | use case | Contract |
| `server/src/coverage/coverage-ranking.ts` | create | route | Contract |
| `server/src/coverage/coverage-ranking.test.ts` | create | — | none (body by TDD) |
| `server/src/coverage/lcov-artifact.ts` | create | adapter | Contract |
| `server/src/coverage/istanbul-artifact.ts` | create | adapter | Contract |
| `server/src/coverage/cobertura-artifact.ts` | create | adapter | Contract |
| `server/src/coverage/lcov-artifact.test.ts` | create | — | none (body by TDD) |
| `server/src/coverage/istanbul-artifact.test.ts` | create | — | none (body by TDD) |
| `server/src/coverage/cobertura-artifact.test.ts` | create | — | none (body by TDD) |
| `server/src/coverage/artifact-files.ts` | create | app wiring | Contract |
| `server/src/coverage/artifact-files.test.ts` | create | — | none (body by TDD) |
| `server/src/api/coverage-payload.ts` | create | route | Contract |
| `server/src/api/routes.ts` | modify | the app | Current state |
| `server/src/app.ts` | modify | entrypoint | Current state |
| `server/src/api/routes.test.ts` | modify | — | none (body by TDD) |
| `server/src/app.test.ts` | modify | — | none (body by TDD) |
| `server/src/api/errors.test.ts` | modify | — | none (body by TDD) |
| `web/src/api/types.ts` | modify | client, block | Contract |
| `web/src/api/client.ts` | modify | block | Current state |
| `web/src/api/client.test.ts` | modify | — | none (body by TDD) |
| `web/src/format.ts` | modify | block | Contract |
| `web/src/format.test.ts` | modify | — | none (body by TDD) |
| `web/src/champion-rows.ts` | create | block | Contract |
| `web/src/champion-rows.test.ts` | create | — | none (body by TDD) |
| `web/src/Champions.tsx` | create | App | Contract |
| `web/src/Champions.test.tsx` | create | — | none (body by TDD) |
| `web/src/App.tsx` | modify | the shell | Current state |
| `web/src/App.test.tsx` | modify | — | none (body by TDD) |

## 5. Interfaces

Consumes: the issue declares no dependency section and no inherited context, so this slice
consumes only what is already in the repo: `Catalog.list()` and `Catalog.resolve(id)` from
`server/src/repos.ts`, `createCache(limit)` and its `Cache<T>` from `server/src/api/routes.ts`,
`ApiError` from `server/src/api/errors.ts`, and in `web/` the `request` helper behind
`web/src/api/client.ts` plus the tokens of `web/src/tokens.css`.

Produces, for later slices: `CoverageRanking.run(): Promise<RankedCoverage>` and the
`CoverageArtifacts` port with its `ArtifactFiles` adapter; the `CoverageReading` vocabulary with
`CoverageReadings.of / .noArtifact / .unreadableArtifact`; `LineCount.of(covered, total)` with
`percentage()`; `CoveragePayload.of(ranked)`; `fetchCoverage(signal?)` in `web/`; and the
`RepoCoverage` payload type in `web/src/api/types.ts`.

## 6. Test strategy

Vitest beside the code, run from the root with `npm test` (`npm test -w server` and
`npm test -w web` for one workspace, plus a file path to narrow it). Outside-in: the application
layer first with the `CoverageArtifacts` port doubled (Task 2), then the boundary readers over
literal artefact text (Task 3), then the adapter over real files written in `tmp` with `node:fs`
— never with the adapter itself (Task 4), then the endpoint over `createApp(deps)` (Task 5), then
the `web/` client, copy, rows and block (Tasks 6 to 8). The domain values of Task 1 get no tests
of their own: they are covered along the application path, which is what ct's testing document
asks for. One fixture per supported format, plus the "no artefact", "corrupt artefact" and
"artefact with no lines" cases the issue demands. Every new assertion has to be seen failing for
the reason its name gives before it is left green.

## 7. Tasks

### Task 1 — the coverage domain vocabulary

**Objective:** declare the closed vocabulary of a coverage reading, its line counter, its error
and its port, so nothing downstream has to represent an absent measure as an optional.

**Files:** `server/src/coverage/line-count.ts` (create),
`server/src/coverage/coverage-format.ts` (create), `server/src/coverage/coverage-reading.ts`
(create), `server/src/coverage/repo-coverage.ts` (create),
`server/src/coverage/unreadable-artifact.ts` (create),
`server/src/coverage/coverage-artifacts.ts` (create).

`LineCount.percentage()` is `covered / total` rounded to one decimal, and it is only ever called
on a measured reading. `CoverageReadings.of` is the single place that decides that a count with
`total === 0` does not count: it answers `noArtifact()` instead of a measured reading, so the
three format readers never repeat that rule.

Contract (server/src/coverage/line-count.ts):

```ts
export class LineCount {
  static of(covered: number, total: number): LineCount
  private constructor(readonly covered: number, readonly total: number)
  percentage(): number
}
```

Contract (server/src/coverage/coverage-reading.ts):

```ts
export type CoverageState = 'measured' | 'no-artifact' | 'unreadable-artifact'

export type CoverageReading =
  | { state: 'measured'; lines: LineCount; source: CoverageFormat; measuredAt: Date }
  | { state: 'no-artifact' }
  | { state: 'unreadable-artifact' }

export class CoverageReadings {
  static of(lines: LineCount, source: CoverageFormat, measuredAt: Date): CoverageReading
  static noArtifact(): CoverageReading
  static unreadableArtifact(): CoverageReading
}
```

Contract (server/src/coverage/coverage-artifacts.ts):

```ts
export interface CoverageArtifacts {
  readingOf(repoPath: string): Promise<CoverageReading>
}
```

`server/src/coverage/coverage-format.ts` declares
`export type CoverageFormat = 'istanbul' | 'lcov' | 'cobertura'`.
`server/src/coverage/repo-coverage.ts` declares
`export interface RepoCoverage { id: string; reading: CoverageReading }`.
`server/src/coverage/unreadable-artifact.ts` declares
`export class UnreadableArtifact extends Error`, named for what happens and carrying no code:
one case, told apart by its class.

**TDD:** No TDD — these are domain values with no validation of their own, covered along the
application path of Task 2, which is what ct's testing document requires.

**Tests:** N/A — no test file in this commit, by the rule above.

**Verification:** the typecheck of the whole `server/src` (tests included) and the lint pass; the
six files exist and none of them carries a comment or a docstring, which the no-prose rule of
ct's style document forbids in new code.

```bash
npm run build -w server   # expected: exit 0 — the six new modules typecheck
npm run lint   # expected: exit 0
test "$(grep -rl '//' server/src/coverage | wc -l)" -eq 0   # expected: exit 0 — no prose
```

### Task 2 — the order of the ranking and the use case that answers it

**Objective:** rank every clone of the root by line coverage, with the clones that have no
percentage last and an unreadable artefact reported instead of sinking the ranking.

**Files:** `server/src/coverage/coverage-order.ts` (create),
`server/src/coverage/coverage-ranking.ts` (create),
`server/src/coverage/coverage-ranking.test.ts` (create).

`CoverageOrder` is the exact rule and nothing else: it dispatches over `CoverageState` with no
catch-all branch, ranks `measured` before `no-artifact` and `unreadable-artifact`, orders the
measured by `percentage()` descending, and breaks every tie by `id` ascending compared by code
unit — the same reason `byName` in `server/src/repos.ts` avoids `localeCompare`: the answer must
not change between machines with a different `LANG`.

`CoverageRanking` asks the catalog for the clones and the port for each reading, in parallel like
`Catalog.list` does, and turns a FAILED reading from the port into
`CoverageReadings.unreadableArtifact()`. That mapping lives here, in the use case: it is the
policy of what to do with one clone's failure, and an adapter does not decide policy.

The policy covers every failure, not only `UnreadableArtifact`: the readings travel on one
`Promise.all`, so an error that escaped this method would reject the whole ranking and take the
reading of every other clone down with it. What the readers' own `UnreadableArtifact` buys is the
silence: it is a reported state of the vocabulary and needs no trace, while any other error is
warned about the way `createCatalog` in `server/src/repos.ts` warns about a clone whose git it
cannot read — without a trace, a bug in a reader would be indistinguishable from a malformed
artefact.

Contract (server/src/coverage/coverage-order.ts):

```ts
export class CoverageOrder {
  sort(entries: readonly RepoCoverage[]): RepoCoverage[]
}
```

Contract (server/src/coverage/coverage-ranking.ts):

```ts
export interface RankedCoverage {
  entries: readonly RepoCoverage[]
}

export class CoverageRanking {
  constructor(deps: { catalog: Catalog; artifacts: CoverageArtifacts; order: CoverageOrder })
  run(): Promise<RankedCoverage>
}
```

**TDD:** red first with
`test('two clones with the same percentage are ordered by name')` over a double of
`CoverageArtifacts` that answers by the path it is asked for and raises for a path nobody wrote
an answer for. The boundary is pinned by two cases: two clones at exactly the same percentage
(the name decides) and two clones 0.1 apart (the percentage decides, and the name order is the
opposite one, so a sort that ignored the percentage would fail).

**Tests:** added to `server/src/coverage/coverage-ranking.test.ts`:
`test('the ranking puts the higher percentage first')`,
`test('two clones with the same percentage are ordered by name')`,
`test('a clone with no artifact ranks after every measured clone')`,
`test('an unreadable artifact ranks with the clones that have no data')`,
`test('a clone whose artifact cannot be read is reported as unreadable instead of sinking the ranking')`,
`test('a clone whose read fails for an unforeseen reason does not sink the reading of the others')`.

**Verification:** the six assertions run green, and the module's own count is checked instead of
the suite total.

```bash
npm test -w server -- src/coverage/coverage-ranking.test.ts   # expected: exit 0
test "$(grep -c "^test('" server/src/coverage/coverage-ranking.test.ts)" -eq 6   # expected: exit 0
npm run build -w server   # expected: exit 0
```

### Task 3 — the three coverage formats, read by projection

**Objective:** turn the literal text of an istanbul, lcov or cobertura artefact into a
`LineCount`, and raise `UnreadableArtifact` for a text that is not that format.

**Files:** `server/src/coverage/istanbul-artifact.ts` (create),
`server/src/coverage/lcov-artifact.ts` (create),
`server/src/coverage/cobertura-artifact.ts` (create),
`server/src/coverage/istanbul-artifact.test.ts` (create),
`server/src/coverage/lcov-artifact.test.ts` (create),
`server/src/coverage/cobertura-artifact.test.ts` (create).

These are boundary readers of a foreign format with an open vocabulary, so each one projects by
hand the keys it consumes and validates that projection, rejecting a wrong type and ignoring
every other key the tool may add:

- istanbul: `total.lines.covered` and `total.lines.total` of `coverage-summary.json`. Text that
  is not JSON, or whose two keys are present with a non-numeric value, raises. JSON with no
  `total.lines` object answers `LineCount.of(0, 0)`.
- lcov: the sum of every `LH:` and every `LF:` record line. A text with no `SF:` record header is
  not lcov and raises. Records with `SF:` and no `LF:` answer `LineCount.of(0, 0)`.
- cobertura: the `lines-covered` and `lines-valid` attributes of the root `<coverage` element. A
  text with no `<coverage` element raises; the element with neither attribute answers
  `LineCount.of(0, 0)`; a non-numeric attribute raises.

Contract (server/src/coverage/istanbul-artifact.ts):

```ts
export class IstanbulArtifact {
  static linesFrom(text: string): LineCount
}
```

`server/src/coverage/lcov-artifact.ts` declares `export class LcovArtifact` and
`server/src/coverage/cobertura-artifact.ts` declares `export class CoberturaArtifact`, each with
the same single static method `linesFrom(text: string): LineCount`.

**TDD:** red first with
`test('an lcov file adds up the LF and LH counters of every record')`, whose arrange is the
literal text of a two-record lcov file (`SF:`/`LF:`/`LH:`/`end_of_record`) and whose assertion is
the covered and total pair, not a re-implementation of the format. Then the same for the other
two readers.

**Tests:** added: `test('a coverage summary reads the covered and total lines of its total section')`,
`test('a coverage summary with no lines section yields no lines')`,
`test('a text that is not JSON is not a coverage summary and raises UnreadableArtifact')`,
`test('an lcov file adds up the LF and LH counters of every record')`,
`test('an lcov record with no LF counter yields no lines')`,
`test('a text with no SF record is not lcov and raises UnreadableArtifact')`,
`test('a cobertura report reads lines-valid and lines-covered of its root element')`,
`test('a cobertura report with no line attributes yields no lines')`,
`test('a text with no coverage element is not cobertura and raises UnreadableArtifact')`.

**Verification:** the three readers pass their own files, three assertions each.

```bash
npm test -w server -- src/coverage/istanbul-artifact.test.ts src/coverage/lcov-artifact.test.ts src/coverage/cobertura-artifact.test.ts   # expected: exit 0
test "$(grep -c "^test('" server/src/coverage/lcov-artifact.test.ts)" -eq 3   # expected: exit 0
npm run build -w server   # expected: exit 0
```

### Task 4 — the adapter that finds the artefact on disk and caches its parse

**Objective:** answer the reading of one clone from the artefacts already on disk, in the closed
candidate order, dated with the artefact's mtime and parsed once per mtime.

**Files:** `server/src/coverage/artifact-files.ts` (create),
`server/src/coverage/artifact-files.test.ts` (create).

The adapter is named after its implementation, not after its port. It walks
`COVERAGE_CANDIDATES` in order; for each candidate it `stat`s the file (a missing or unreadable
one is simply the next candidate, exactly as `statOrNull` treats it in `server/src/repos.ts`),
asks the cache to remember the parse under the clone path, the candidate path and the mtime in
milliseconds joined by NUL, and answers the first reading whose state is `measured`. A candidate
that yields no lines is skipped; when no candidate is measured the answer is
`CoverageReadings.noArtifact()`. `UnreadableArtifact` from a reader travels out untouched: what
to do with it is the use case's decision. The cache limit arrives through the constructor with no
default, because applying a bound is this layer's work and choosing it is not.

Contract (server/src/coverage/artifact-files.ts):

```ts
export const COVERAGE_CANDIDATES: readonly { path: string; source: CoverageFormat }[] = [
  { path: 'coverage/coverage-summary.json', source: 'istanbul' },
  { path: 'coverage/lcov.info', source: 'lcov' },
  { path: 'lcov.info', source: 'lcov' },
  { path: 'coverage/coverage.xml', source: 'cobertura' },
  { path: 'coverage.xml', source: 'cobertura' },
]

export class ArtifactFiles implements CoverageArtifacts {
  constructor(cache: Cache<CoverageReading>)
  readingOf(repoPath: string): Promise<CoverageReading>
}
```

**TDD:** red first with `test('the coverage summary of a clone wins over its lcov file')`: a
directory in `tmp` written with `node:fs` carrying both artefacts with different percentages, and
the assertion on the `source` and the percentage of the reading. `test('a second read of an
unchanged artifact does not parse it again')` pins the cache with a spy over the reader, and its
pair `test('an artifact whose mtime moved is parsed again')` moves the mtime with `utimesSync`,
the way `server/src/api/routes.test.ts` already does.

**Tests:** added to `server/src/coverage/artifact-files.test.ts`:
`test('the coverage summary of a clone wins over its lcov file')`,
`test('a clone with only an lcov file at its root is measured from it')`,
`test('a clone with no coverage artifact reads as no data instead of zero per cent')`,
`test('an artifact with no lines is skipped and the next candidate answers')`,
`test('the measure date is the mtime of the artifact that was read')`,
`test('a second read of an unchanged artifact does not parse it again')`,
`test('an artifact whose mtime moved is parsed again')`.

**Verification:** the seven assertions run green over real files in `tmp`, and no test leaves its
temporary directory behind.

```bash
npm test -w server -- src/coverage/artifact-files.test.ts   # expected: exit 0
test "$(grep -c "^test('" server/src/coverage/artifact-files.test.ts)" -eq 7   # expected: exit 0
npm run build -w server   # expected: exit 0
```

### Task 5 — `GET /api/coverage`

**Objective:** serve the ranking of every clone of the root under `/api`, in the same typed
envelope as the four endpoints already there.

**Files:** `server/src/api/coverage-payload.ts` (create), `server/src/api/routes.ts` (modify),
`server/src/app.ts` (modify), `server/src/api/routes.test.ts` (modify),
`server/src/app.test.ts` (modify), `server/src/api/errors.test.ts` (modify).

The last two are the price of the new required field: both build an `AppDeps` literal of their
own, so both stop typechecking until each one names `coverage`. They get that one field and
nothing else.

The conversion to the wire lives in the boundary model, both ways, never in the use case: the
three states become the `null` fields the issue's payload declares, and `state` travels beside
them so a clone with no artefact and a clone with an unreadable one stay distinguishable — with
only the nulls, the two would collapse into one answer the UI could not tell apart.

`server/src/app.ts` gains `coverage: CoverageRanking` in `AppDeps`, and `createDeps()` — the only
place that assembles the graph — builds
`new CoverageRanking({ catalog, artifacts: new ArtifactFiles(createCache(COVERAGE_CACHE_LIMIT)), order: new CoverageOrder() })`
with `const COVERAGE_CACHE_LIMIT = 64`, the bound the other two caches of the API already use.

Current state (server/src/api/routes.ts, lines 33-35):

```ts
  router.get('/repos', async (_request, response) => {
    response.json({ repos: await deps.catalog.list() })
  })
```

Contract (server/src/api/coverage-payload.ts):

```ts
export interface CoverageEntryPayload {
  id: string
  state: CoverageState
  percentage: number | null
  lines: { covered: number; total: number } | null
  source: CoverageFormat | null
  measuredAt: string | null
}

export class CoveragePayload {
  static of(ranked: RankedCoverage): { coverage: CoverageEntryPayload[] }
}
```

Call site (server/src/api/routes.ts):

```ts
  router.get('/coverage', async (_request, response) => {
    response.json(CoveragePayload.of(await deps.coverage.run()))
  })
```

**TDD:** red first with
`test('GET /api/coverage ranks every clone of the root by line coverage')` over `createApp(deps)`
and two clones written in `tmp`, asserting the literal payload array. Then
`test('GET /api/coverage carries no author name or email')`, which greps the serialized body for
the distinctive `AUTHOR` constant already in that file — the assertion that keeps identity out
of this new endpoint.

**Tests:** added to `server/src/api/routes.test.ts`:
`test('GET /api/coverage ranks every clone of the root by line coverage')`,
`test('GET /api/coverage answers null percentage for a clone with no artifact')`,
`test('GET /api/coverage carries no author name or email')`.

**Verification:** the endpoint answers the ranking, the envelope of the whole file still holds,
and no route file mentions an author field.

```bash
npm test -w server -- src/api/routes.test.ts   # expected: exit 0
test -z "$(grep -l 'email' server/src/api/coverage-payload.ts)"   # expected: exit 0
npm run build -w server   # expected: exit 0
npm run lint   # expected: exit 0
```

### Task 6 — the payload type and the client call in `web/`

**Objective:** let `web/` ask for the coverage of every clone with its own declared types and the
error handling the other calls already have.

**Files:** `web/src/api/types.ts` (modify), `web/src/api/client.ts` (modify),
`web/src/api/client.test.ts` (modify).

The types are declared here and not imported from `server/`: a type imported from there could
drag author identity into the DOM, which is the one thing that must not happen. Keeping the two
declarations in step is the copy the boundary forces, and it is the reason Task 5's assertion is
on the literal payload of the endpoint.

Contract (web/src/api/types.ts):

```ts
export type CoverageFormat = 'istanbul' | 'lcov' | 'cobertura'

export type CoverageState = 'measured' | 'no-artifact' | 'unreadable-artifact'

export interface RepoCoverage {
  id: string
  state: CoverageState
  percentage: number | null
  lines: { covered: number; total: number } | null
  source: CoverageFormat | null
  measuredAt: string | null
}
```

Current state (web/src/api/client.ts, lines 18-21):

```ts
export async function fetchRepos(signal?: AbortSignal): Promise<Clone[]> {
  const body = await request<{ repos: Clone[] }>('/api/repos', { signal })
  return body.repos
}
```

`fetchCoverage(signal?: AbortSignal): Promise<RepoCoverage[]>` is added right beside it, reading
`/api/coverage` through the same `request` helper and answering `body.coverage`, so a failed
response arrives at the caller as an `ApiError` carrying the server's code.

**TDD:** red first with `test('fetchCoverage reads the coverage array of the envelope')` over a
stubbed `fetch`, then `test('fetchCoverage turns an error envelope into an ApiError with its
code')`, asserting the `code` and not the HTTP status — the status is not looked at once the
envelope has been read.

**Tests:** added to `web/src/api/client.test.ts`:
`test('fetchCoverage reads the coverage array of the envelope')`,
`test('fetchCoverage turns an error envelope into an ApiError with its code')`.

**Verification:** the client file passes, and `web/` still imports nothing from `server/`.

```bash
npm test -w web -- src/api/client.test.ts   # expected: exit 0
test -z "$(grep -rl "from '\.\./\.\./server" web/src)"   # expected: exit 0
npm run build -w web   # expected: exit 0
```

### Task 7 — the Spanish copy and the rows of the ranking

**Objective:** turn a coverage reading into the text and the geometry the block draws, in one
place, with no component deciding any of it.

**Files:** `web/src/format.ts` (modify), `web/src/format.test.ts` (modify),
`web/src/champion-rows.ts` (create), `web/src/champion-rows.test.ts` (create).

`web/src/format.ts` is where the API's English values become the Spanish the user reads, so the
three sentences go there: a measured coverage as `72,4 %` with one decimal and the comma of
`es-ES`, `no-artifact` as `Sin datos de cobertura`, `unreadable-artifact` as
`Artefacto de cobertura ilegible`, and the age of the measure through the `relativeDays` that
already exists — reused, not written again. `coverageAge` answers `sin fecha` when
`measuredAt` is `null`.

`web/src/champion-rows.ts` holds every decision the block would otherwise take inline: the row
order comes from the server untouched, the bar width is the percentage in per cent and `null`
when there is none — the absence goes in the type, because a `0` there is the measure of a clone
covered at 0 % and the block would draw the two the same — and `selected` is the row whose `id`
is the clone chosen in the header.

Contract (web/src/champion-rows.ts):

```ts
export interface ChampionRow {
  id: string
  name: string
  headline: string
  age: string
  source: string
  barPercent: number | null
  selected: boolean
}

export class ChampionRows {
  static of(coverage: readonly RepoCoverage[], repos: readonly Clone[], repoId: string, now: Date): ChampionRow[]
  static emptyHeadline(): string
}
```

`ChampionRows.emptyHeadline()` is the sentence for a ranking where no clone is measured:
`Ningún clon trae datos de cobertura.`

**TDD:** red first with `test('a clone with no artifact is shown as sin datos de cobertura')` in
`web/src/format.test.ts`, whose assertion is the whole distinctive sentence and not a substring
of it. The one-decimal rule is pinned by two cases either side of the rounding boundary: a
coverage of `72.35` and one of `72.34`.

**Tests:** added to `web/src/format.test.ts`:
`test('a measured coverage is shown with one decimal')`,
`test('a coverage is rounded to one decimal at the boundary')`,
`test('a clone with no artifact is shown as sin datos de cobertura')`,
`test('an unreadable artifact is shown as ilegible')`,
`test('a measure with no date is shown as sin fecha')`. Added to
`web/src/champion-rows.test.ts`: `test('the selected clone is marked in the ranking')`,
`test('a clone with no percentage gets no bar')`,
`test('a clone measured at zero per cent keeps its bar, unlike one with no data')`,
`test('the order the server sent is kept untouched')`,
`test('a ranking with no measured clone answers its own headline')`.

**Verification:** both files pass and the copy lives only in `web/src/format.ts`.

```bash
npm test -w web -- src/format.test.ts src/champion-rows.test.ts   # expected: exit 0
test "$(grep -c 'Sin datos de cobertura' web/src/format.ts)" -eq 1   # expected: exit 0
npm run build -w web   # expected: exit 0
```

### Task 8 — the «Campeones» block in the dashboard

**Objective:** draw the ranking of the clones by coverage beside Pulso, Gente and Calor, with its
three unhappy states visible.

**Files:** `web/src/Champions.tsx` (create), `web/src/Champions.test.tsx` (create),
`web/src/App.tsx` (modify), `web/src/App.test.tsx` (modify).

The block loads `/api/coverage` itself and owns its own error state, the way
`web/src/Heat.tsx` does with its level: the coverage is root-wide, it does not depend on the
selected window, and a summary that fails must not hide it. It draws name, percentage with bar,
source format and age of the measure, using only the tokens of `web/src/tokens.css`, and it
highlights the row of the clone selected in the header. A row whose `barPercent` is `null` draws
no bar at all — not a bar at 0 % — and keeps the slot so the columns stay aligned. Its three unhappy states are the row
sentence for a clone with no data, `ChampionRows.emptyHeadline()` when no clone has data, and the
same `role="alert"` treatment the other blocks give an API failure.

Contract (web/src/Champions.tsx):

```tsx
export interface ChampionsProps {
  repos: readonly Clone[]
  repoId: string
  now: Date
}

export default function Champions(props: ChampionsProps): JSX.Element
```

Current state (web/src/App.tsx, lines 96-104):

```tsx
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <TrendPanel window={window} trend={summary.trend} kpis={summary.kpis} />
            <HeatBlock
              key={`${repoId}|${window}`}
              repoId={repoId}
              repoName={repoNameOf(repos, repoId)}
              window={window}
            />
          </div>
```

`App` renders `<Champions repos={repos} repoId={repoId} now={now} />` after that grid and outside
the `summary !== null` guard, so the block survives a summary that failed to load.

**TDD:** red first with
`test('the champions block lists every clone with its percentage')` over a stubbed
`fetchCoverage`, asserting the distinctive percentage text of each row. The highlight is pinned
by its own pair: the selected row carries the mark and the other row does not, in the same
assertion, so a component that marked every row would fail.

**Tests:** added to `web/src/Champions.test.tsx`:
`test('the champions block lists every clone with its percentage')`,
`test('only the selected clone is highlighted in the ranking')`,
`test('a clone with no artifact says sin datos de cobertura')`,
`test('a ranking with no measured clone says so instead of drawing an empty block')`,
`test('a failed coverage load shows an alert')`,
`test('a clone measured at zero per cent draws its bar and one with no data draws none')`. Added
to `web/src/App.test.tsx`:
`test('the dashboard mounts the champions block')`.

**Verification:** the whole `web/` suite passes and the block is mounted from the shell.

```bash
npm test -w web   # expected: exit 0
test "$(grep -c '<Champions' web/src/App.tsx)" -eq 1   # expected: exit 0
npm run build -w web   # expected: exit 0
npm run lint   # expected: exit 0
```

## 8. Global verification

Build, tests and lint from the root, over both workspaces, plus the two invariants this slice
must not break: `web/` importing nothing from `server/` and the server binding only
`127.0.0.1`. Then the human part of the `visual` gate: start the API with
`REPO_PULSE_ROOT` pointing at a root whose clones carry different artefacts (one with
`coverage/coverage-summary.json`, one with `lcov.info` only, one with none), run `npm run dev -w web`,
open `http://127.0.0.1:5173`, and capture the dashboard before and after the change with the
«Campeones» block, the highlighted row, the «Sin datos de cobertura» row and the age of each
measure visible. That capture and this route go in the pull request body.

```bash
npm run build   # expected: exit 0 — both workspaces typecheck and web bundles
npm test   # expected: exit 0 — both suites green
npm run lint   # expected: exit 0
test -z "$(grep -rl "from '\.\./\.\./server" web/src)"   # expected: exit 0
test "$(grep -c '127.0.0.1' server/src/index.ts)" -ge 1   # expected: exit 0
```

## 9. Assumptions

1. **Route.** The issue leaves the exact path to the plan: `GET /api/coverage`, root-level like
   `/repos`, because the answer covers every clone of the root and not one repo. Own call.
2. **Format list and candidate paths.** Three formats and five paths, in the order of §2. JaCoCo
   is left out: the issue calls it desirable and non-blocking. Own call, from the issue.
3. **Preference order.** istanbul first because `coverage-summary.json` already carries the
   totals and needs no arithmetic; lcov next because `LF`/`LH` are exact line counters; cobertura
   last because its `line-rate` is a ratio and only its `lines-valid`/`lines-covered` attributes
   give counts. Own call.
4. **First match, not newest.** The walk stops at the first candidate that yields lines instead
   of comparing mtimes across candidates: it is one `stat` per candidate at most and the answer
   is deterministic. The age of the measure is still exposed and painted, which is what the issue
   asks for. Own call.
5. **`state` in the payload.** The issue names six fields; a seventh, `state`, carries the
   vocabulary, because with only the nulls a clone with no artefact and one with a corrupt
   artefact would arrive identical and the UI could not tell them apart. ct's defects document
   forbids exactly that collapse, and it wins over the field list. Own call, from the yardstick.
6. **A corrupt artefact is a visible state.** `Artefacto de cobertura ilegible` is one more row
   sentence. The issue lists three unhappy states and not this one, but the alternative is
   showing corruption as absence. Own call.
7. **An artefact with no lines does not stop the walk.** The issue says such an artefact does not
   count; this plan reads that as "the next candidate answers", and as `no-artifact` when no
   candidate counts. Own call, from the issue.
8. **Cache bound.** `COVERAGE_CACHE_LIMIT = 64`, the same bound `server/src/api/routes.ts`
   already gives its two caches: enough for every clone of a root. Repo convention.
9. **Where the cache lives.** In the adapter, keyed by clone path, candidate path and mtime,
   reusing `createCache` from `server/src/api/routes.ts` instead of deriving a second LRU. The
   import crosses two infrastructure modules, which the layer direction allows. Own call.
10. **React components stay functions.** ct's style document asks that every function hang off a
    type; a React component is the framework's own entry shape and every block in this repo is a
    function component (`web/src/Heat.tsx`, `web/src/People.tsx`). So `web/src/Champions.tsx`
    keeps that shape and every decision it would otherwise take inline lives in the
    `ChampionRows` class of `web/src/champion-rows.ts`. Own call.
11. **`Catalog` as a port.** `CoverageRanking` depends on the `Catalog` interface declared in
    `server/src/repos.ts`, not on its factory, so the use case depends on a port and the test
    doubles it. Repo convention.
12. **Nothing inherited.** The issue's "Contexto heredado" section is empty, so this slice
    assumes no merged work conditions it. From the issue.
