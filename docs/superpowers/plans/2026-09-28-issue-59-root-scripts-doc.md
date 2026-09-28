# #59 — CT-680 smoke: document the root scripts

> **Task-scoped subagents execute this plan.** They arrive with no context. They decide
> nothing. Each task carries the state of what it changes, copied exactly from the repo, and
> the contracts it obeys and the commands that verify it.

> You write the bodies. You write the test first. This document decided the names, the
> signatures, the constants and the test names. If a decision is not clear, follow the issue
> body and AGENTS.md.

## 1. Context and goal

The root `package.json` declares three scripts: `build`, `test` and `lint`. `AGENTS.md`
explains in its "Build, test & lint" section what each one runs in the two workspaces. No
document under `docs/` lists them today, and `docs/verification/` does not exist. The issue asks
for one new Spanish document, `docs/verification/ct-680-root-scripts.md`. It names each root
script, its exact command and what that command runs.

### Desired end state

- `docs/verification/ct-680-root-scripts.md` exists and names every script of the root
  `package.json` with its exact command: `build`, `test` and `lint`.
- For each script, the document says what the command runs, as `package.json` and `AGENTS.md`
  state it.
- No other file of the repo changes, apart from this plan.

### Out of scope

The issue protects application code, configuration, existing tests, `README.md` and `AGENTS.md`.
This slice adds no test, no script and no configuration. Nobody merges the pull request of this
slice: the issue calls it a disposable verification.

## 2. Closed decisions (take as given)

The issue carries no "Decisiones congeladas" section. The plan closes these decisions:

| Decision | Value |
|---|---|
| Path of the document | `docs/verification/ct-680-root-scripts.md`, as the issue states |
| Language of the document | Spanish: the issue asks for it, and `AGENTS.md` keeps in Spanish what a person reads |
| Scripts in the document | the three of the root `package.json`: `build`, `test` and `lint`, and no workspace script |
| Source of each fact | the root `package.json`, `server/package.json`, `web/package.json` and `AGENTS.md`; nothing else |

## 3. Reference patterns

Files to imitate: N/A — no document under `docs/` has the same role; the text is in §7.

Rules to obey: `AGENTS.md` (Spanish for documents that people read, and the facts about each
script in its "Build, test & lint" section).

## 4. Inventory

| File | Action | Consumed by | Block in §7 |
|---|---|---|---|
| `docs/verification/ct-680-root-scripts.md` | create | a human reader | Final text |

## 5. Interfaces

Consumes: N/A — no dependencies.

Produces: N/A — a document; no later slice relies on it.

## 6. Test strategy

The deliverable is one Markdown document, so the slice adds no Vitest test. A `node` command in
the verification of Task 1 reads the `scripts` of the root `package.json`. It fails if the
document does not contain a script name or its exact command.

## 7. Tasks

### Task 1 — the document of the root scripts

**Objective:** A reader finds each root script with its exact command in `docs/verification/ct-680-root-scripts.md`.

**Files:** `docs/verification/ct-680-root-scripts.md` (create)

Final text (docs/verification/ct-680-root-scripts.md):

```markdown
# Scripts del `package.json` raíz

Fuente: el `package.json` raíz y la sección "Build, test & lint" de `AGENTS.md`. Se lanzan desde la raíz con `npm run <script>` y cada uno cubre los dos workspaces (`server/` y `web/`).

| Script | Comando exacto | Qué ejecuta |
|---|---|---|
| `build` | `npm run build --workspaces` | En `server/`: typecheck de todo `src` con `tsconfig.json` (tests incluidos) y emit a `dist/` con `tsconfig.build.json`. En `web/`: `tsc --noEmit` + `vite build`. |
| `test` | `npm run test --workspaces` | Vitest (`vitest run`) en cada workspace. |
| `lint` | `eslint .` | ESLint 9 (flat config en `eslint.config.js`) sobre todo el repo. |
```

Write the file with exactly this text. Each fact comes from the root `package.json`, from
`server/package.json`, from `web/package.json` or from the "Build, test & lint" section of
`AGENTS.md`.

**TDD:** No TDD — the deliverable is a document; the `node` predicate below reads `package.json` and checks the document.

**Tests:** N/A — the slice adds no test file.

**Verification:** The `node` command exits 0 only if the document names every root script and its exact command. The `git` command exits 0 only if the task changes nothing outside `docs/`.

```bash
node -e "const s=require('./package.json').scripts;const d=require('fs').readFileSync('docs/verification/ct-680-root-scripts.md','utf8');process.exit(Object.entries(s).every(([k,v])=>d.includes(k)&&d.includes(v))?0:1)"   # expected: exit 0 — every script name and command appears in the document
test -z "$(git status --porcelain -- . ':!docs')"   # expected: exit 0 — no change outside docs/
```

## 8. Global verification

These commands check the slice against its base. The first repeats the check of the document.
The second proves that the branch changes nothing outside `docs/`.

```bash
node -e "const s=require('./package.json').scripts;const d=require('fs').readFileSync('docs/verification/ct-680-root-scripts.md','utf8');process.exit(Object.entries(s).every(([k,v])=>d.includes(k)&&d.includes(v))?0:1)"   # expected: exit 0 — the document names every root script with its exact command
test -z "$(git diff --name-only main...HEAD -- . ':!docs')"   # expected: exit 0 — the branch touches only docs/
```

## 9. Assumptions

1. The issue has no "Decisiones congeladas" section, so §2 is empty (issue).
2. The column "Qué ejecuta" copies the wording of `AGENTS.md`, because the issue says to take the facts from `package.json` and `AGENTS.md` (issue).
3. The slice adds no Vitest test. A test over a document adds a test file that the issue does not ask for (own call).
4. The Global verification compares against `main`, the base in `.agent/SLICE.md` (repo convention).
