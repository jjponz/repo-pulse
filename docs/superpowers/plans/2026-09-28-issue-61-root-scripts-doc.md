# #61 — document the scripts of the root package.json

> **Task-scoped subagents execute this plan.** They arrive with no context. They decide
> nothing. Each task carries the state of what it changes, copied exactly from the repo, and
> the contracts it obeys and the commands that verify it.

> You write the bodies. You write the test first. This document decided the names, the
> signatures, the constants and the test names. If a decision is not clear, follow the issue
> body and AGENTS.md.

## 1. Context and goal

The root `package.json` declares three scripts: `build`, `test` and `lint`. `AGENTS.md`
describes them in its section "Build, test & lint". No document under `docs/` lists them.
The issue asks for one new document, `docs/verification/ct-680-root-scripts-2.md`, in Spanish.
It names every root script with its exact command and says what that command runs.

### Desired end state

- WHEN a reader opens `docs/verification/ct-680-root-scripts-2.md` THE document SHALL name
  every script of the root `package.json` with its exact command.

### Out of scope

Application code, configuration, existing tests, `README.md` and `AGENTS.md` stay as they are.
The slice adds one file and changes no other file.

## 2. Closed decisions (take as given)

| Decision | Value |
|---|---|
| Output file | `docs/verification/ct-680-root-scripts-2.md`, and no other new file |
| Language of the document | Spanish, as the issue asks for repository documentation |
| Source of the facts | `package.json`, `server/package.json`, `web/package.json` and `AGENTS.md` |
| Shape | One table with the columns `Script`, `Comando exacto` and `Qué ejecuta` |

## 3. Reference patterns

Files to imitate: N/A — no document under `docs/` has this role yet.

Rules to obey: `AGENTS.md` (text that a person reads as product or conversation stays in
Spanish; the "Do NOT touch" section).

## 4. Inventory

| File | Action | Consumed by | Block in §7 |
|---|---|---|---|
| `docs/verification/ct-680-root-scripts-2.md` | create | a human reader | Final text |

## 5. Interfaces

Consumes: N/A — no dependencies.

Produces: N/A — the slice produces a document, not an interface.

## 6. Test strategy

The slice adds no code, so it adds no Vitest test. Shell predicates in the task and in §8
prove the acceptance criterion. The §8 predicate reads every script from the root
`package.json` and fails if the document omits its name or its exact command.

## 7. Tasks

### Task 1 — the document of the root scripts

**Objective:** The new document names each root script with its exact command and what it runs.

**Files:** `docs/verification/ct-680-root-scripts-2.md` (create)

Final text (docs/verification/ct-680-root-scripts-2.md):

```markdown
# Scripts del `package.json` raíz

Se ejecutan desde la raíz del repositorio con `npm run <script>`.

| Script | Comando exacto | Qué ejecuta |
|---|---|---|
| `build` | `npm run build --workspaces` | El `build` de cada workspace. En `server/`: `tsc --noEmit -p tsconfig.json && tsc -p tsconfig.build.json` (comprobación de tipos de todo `src` y emisión a `dist/`). En `web/`: `tsc --noEmit -p tsconfig.json && vite build`. |
| `test` | `npm run test --workspaces` | El `test` de cada workspace: `vitest run` en `server/` y en `web/`. |
| `lint` | `eslint .` | ESLint 9 con la configuración plana de `eslint.config.js` sobre todo el repositorio. |
```

**TDD:** No TDD — the deliverable is a document; the shell predicates below check it.

**Tests:** N/A — the slice adds no code.

**Verification:** The document exists, carries each exact command, and no other file changes.

```bash
test -f docs/verification/ct-680-root-scripts-2.md   # expected: exit 0 — the file exists
grep -qF '`npm run build --workspaces`' docs/verification/ct-680-root-scripts-2.md   # expected: exit 0 — build command present
grep -qF '`npm run test --workspaces`' docs/verification/ct-680-root-scripts-2.md   # expected: exit 0 — test command present
grep -qF '`eslint .`' docs/verification/ct-680-root-scripts-2.md   # expected: exit 0 — lint command present
test -z "$(git status --porcelain -- README.md AGENTS.md package.json server web eslint.config.js)"   # expected: exit 0 — protected files unchanged
```

## 8. Global verification

The predicate reads the root `package.json` and exits 1 if one script or command is absent.

```bash
node -e 'const fs=require("fs");const s=JSON.parse(fs.readFileSync("package.json","utf8")).scripts;const d=fs.readFileSync("docs/verification/ct-680-root-scripts-2.md","utf8");const miss=Object.entries(s).filter(([n,c])=>!d.includes("`"+n+"`")||!d.includes("`"+c+"`"));if(miss.length){console.error(miss);process.exit(1)}'   # expected: exit 0 — every root script and its exact command appear
test -z "$(git diff --name-only main -- README.md AGENTS.md package.json server web eslint.config.js)"   # expected: exit 0 — no protected file differs from main
```

## 9. Assumptions

1. The document says what each command runs from the workspace scripts and `AGENTS.md`. Provenance: issue.
2. The baseline in `.agent/SLICE.md` is `no-verificado`. The slice changes no code, so the plan goes on without it. Provenance: own call.
3. The plan prose is in English under the Simplified Technical English gate; the document is in Spanish. Provenance: repo convention and issue.
