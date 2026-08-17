# #4 — API HTTP con caché por HEAD

> **This plan is written to be executed by task-scoped subagents.**

## 1. Context and goal

`app.ts` sólo sirve `GET /api/health`: aquí va Express delante.

### Desired end state

Los cuatro endpoints verdes contra fixtures: los cinco AC son sus tests.

### Out of scope

🚫 Nada que mute el clon; ni `web/`, ni BD, ni candidatos de carpeta principal.

## 2. Closed decisions (do NOT reopen)

| Decision | Value |
|---|---|
| Entorno | `REPO_PULSE_ROOT` (`~/git`) y `REPO_PULSE_DATA_DIR` (`~/.repo-pulse/settings.json`), en `createDeps` |
| Catálogo | `readdir`+`stat` (symlinks), sólo directorios; `list()` con `.git`, `resolve(id)` cualquier hijo (`/` o `..` → 404) |
| Errores | `{error:{code,message}}`: 404 `unknown-repo`, 422 `not-a-git-repo`, 400 `invalid-window`/`-body`, 500 `git-failed`; sin commits no es error (200, `headSha: null`) |
| Payloads | summary `{...Analysis, meta:{lastCommitAt,fetchedAt,stale}}`, heat `{window, ...Heat}`, repos `{repos:[{id,name,path,lastCommitAt,fetchedAt}]}`; sin `window`, `DEFAULT_WINDOW` |
| Caché | LRU de 64; clave `repo\0window\0headSha`, +`\0mainFolder\0path` en heat; `readHeadSha` corre siempre: ve avanzar el clon |
| Express | `createApp(deps)`: `express.json()`, router en `/api` tras `/api/health`, `errorHandler` |

## 3. Reference patterns

`analysis/heat.ts` (contrato, JSDoc, inglés).

## 4. Inventory

En `server/src/`. Create: `repos.ts`, `settings.ts`, `api/{routes,errors}.ts`. Modify:
`analysis/{git,index}.ts`, `app.ts`, `index.ts`, `app.test.ts` (`deps`).

## 5. Interfaces

Consumes: el barrel de `analysis/` (#2/#3, en `main`).
Produces: `AppDeps {catalog, settings, analysis, now()}`, `createApp(deps)`, `createCatalog(root,
analysis)`, `freshnessOf(repo, now)`, `createSettingsStore(file)`, `readLastCommitAt(repo)`.

## 6. Test strategy

Supertest sobre `createApp(deps)`: raíz y `settings.json` en `mkdtemp`, fixtures `daysAgo(n)`.

## 7. Tasks

### Task 1 — la API

**Objective:** los cuatro endpoints sobre fixtures, con caché por HEAD y settings en disco.

**Files:** los de §4; tests en `api/routes.test.ts` y `repos.test.ts`.

Contract (server/src/app.ts):

```ts
export type AnalysisPort = Pick<typeof analysis, 'readHeadSha' | 'readLastCommitAt' | 'walkHistory' | 'heatTree'>
```

Current state (server/src/app.ts, lines 4-5):

```ts
export function createApp(): Express {
  const app = express()
```

`readLastCommitAt` = `git log -1 --no-merges --format=%aI HEAD` (null sin HEAD). El store lee al
construir, escribe con temporal + `rename` y, si falta o falla, arranca vacío.

**TDD:** `it('the same HEAD does not walk twice')` — dos peticiones iguales: `walkHistory` 1,
`readHeadSha` 2, cuerpos idénticos.

**Tests:** el del TDD, `'repos lists the clones'`, `'summary carries pulse, people, trend, meta'`,
`'heat lists only that level'`, `'settings survive a restart'`, `'no .git is 422; no commits is
200'`, `'a new commit invalidates the cache'`, `'no author identity in the payload'`.

**Verification:** `npm test -w server`, exit 0 (baseline 72).

## 8. Global verification

`npm run build && npm test && npm run lint`, exit 0 (baseline 73 tests).

## 9. Assumptions

1. Sin commits: el spec lo llama error tipado y repo válido; queda en 200 con
   `headSha: null`, distinguible del 422 — propia.
2. Migración: sólo `settings.json`; forward = la primera escritura lo crea con `version: 1`;
   rollback = borrarlo (nadie más lo lee). Sin paso destructivo.
