# #1 — esqueleto: monorepo npm workspaces con CI y AGENTS.md actualizado

> **This plan is written to be executed by task-scoped subagents with zero context and no
> authority to decide.** Every diff embeds the current state (copied verbatim from the repo)
> and the complete final state. Do not improvise: follow the tasks literally. On ambiguity,
> the issue body and AGENTS.md win.

## 1. Context and goal

El repo solo contiene documentación: `README.md`, `AGENTS.md`, `docs/` (specs y maqueta) y
`.agent/` (estado del loop, no producto). No hay `package.json`, ni código, ni CI (el
directorio `.github/workflows/` no existe). El issue #1 pide el esqueleto del MVP: monorepo
npm workspaces con `web/` (Vite + React + TS) y `server/` (Express + TS), tests con Vitest,
ESLint, CI en GitHub Actions que ejecute build+test+lint en cada PR, y AGENTS.md actualizado
con los comandos reales.

### Desired end state

- `npm run build && npm test && npm run lint` terminan con exit 0 en un checkout limpio
  (tras `npm ci`).
- `.github/workflows/ci.yml` ejecuta build+test+lint en cada PR.
- AGENTS.md documenta esos comandos en sus secciones "Setup commands" y "Build, test & lint".
- Existen los workspaces `server/` (Express 5 + TS, endpoint `GET /api/health` con test) y
  `web/` (Vite + React + TS, app mínima con test), ambos con Vitest.

### Out of scope

- 🚫 La sección "Formato de la tabla de slices (contrato con /ct-groom)" de AGENTS.md no se
  toca: desde la línea que empieza por `## Formato de la tabla de slices` hasta el final del
  fichero no se modifica ni un byte, y tampoco los dos marcadores `ct-init:slices-contract`
  que la preceden.
- Nada del dominio del producto: ni `server/src/analysis/` (slice #2), ni la API real (#4),
  ni la UI de la maqueta (#5–#7). El endpoint `/api/health` es solo la prueba mínima de que
  Express + TS + Vitest funcionan encadenados.
- Sin e2e, sin base de datos, sin Docker, sin publicación de paquetes.

## 2. Closed decisions (do NOT reopen)

| Decision | Value |
|---|---|
| Gestor de paquetes | npm con workspaces (`server`, `web`), un solo `package-lock.json` en la raíz |
| Módulos | ESM en todo el repo: `"type": "module"` en los tres `package.json` |
| TypeScript | Compartido vía `tsconfig.base.json` en la raíz (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`); la dependencia `typescript` se declara SOLO en la raíz |
| Express | v5 (`express@^5.1.0`, `@types/express@^5.0.0`) |
| React | v19 (`react@^19.0.0`, `react-dom@^19.0.0`) |
| Tests | Vitest `^3.0.4` por workspace, script `test` = `vitest run`; ficheros `*.test.ts(x)` junto al código |
| Lint | ESLint 9 flat config ÚNICO en la raíz (`eslint.config.js`): `@eslint/js` recommended + `typescript-eslint` recommended; script raíz `lint` = `eslint .` |
| Scripts raíz | `build` y `test` delegan con `npm run <script> --workspaces`; `lint` corre solo en la raíz |
| Build de server | `tsc -p tsconfig.json` → `dist/`; los `*.test.ts` se excluyen del build |
| Build de web | `tsc --noEmit -p tsconfig.json && vite build` |
| Test de web sin DOM | smoke test que importa `App` y comprueba que es una función; nada de jsdom ni testing-library en este slice |
| CI | Un job en `ubuntu-latest`, Node 22, `npm ci` y luego build, test y lint como pasos separados; dispara en `pull_request` y en push a `main` |
| Imports relativos en `server/` | Con sufijo `.js` (requisito de `moduleResolution: NodeNext` + ESM); Vitest los resuelve a los `.ts` fuente |

## 3. Reference patterns

N/A — el repo no tiene código todavía; los patrones (layout de workspaces, tsconfigs, flat
config de ESLint) los fija este slice y quedan documentados en AGENTS.md para los slices
#2–#7.

## 4. Inventory

| Fichero | Acción | Lo consume |
|---|---|---|
| `.gitignore` | modificar | git (ignorar `node_modules/` y `dist/`) |
| `package.json` | crear | npm (workspaces + scripts raíz), CI |
| `package-lock.json` | generar con `npm install` y commitear | `npm ci` en CI |
| `tsconfig.base.json` | crear | `server/tsconfig.json`, `web/tsconfig.json` |
| `server/package.json` | crear | npm workspace `server` |
| `server/tsconfig.json` | crear | `npm run build -w server` |
| `server/src/app.ts` | crear | `server/src/index.ts`, su test, slice #4 (lo hará crecer) |
| `server/src/index.ts` | crear | `npm start -w server` (arranque local) |
| `server/src/app.test.ts` | crear | `npm test -w server` |
| `web/package.json` | crear | npm workspace `web` |
| `web/tsconfig.json` | crear | `npm run build -w web` |
| `web/vite.config.ts` | crear | vite build/dev y Vitest |
| `web/index.html` | crear | vite |
| `web/src/main.tsx` | crear | vite (entrypoint) |
| `web/src/App.tsx` | crear | `main.tsx`, su test, slice #5 (lo sustituirá por el shell real) |
| `web/src/App.test.tsx` | crear | `npm test -w web` |
| `eslint.config.js` | crear | `npm run lint` |
| `.github/workflows/ci.yml` | crear | GitHub Actions en cada PR |
| `AGENTS.md` | modificar (solo las secciones anteriores al contrato) | agentes de los slices #2–#7 |

## 5. Interfaces

Consumes: N/A — no dependencies. El issue no trae sección "Dependencias" y su columna Dep en
la tabla de slices es `–`: este slice es la raíz del epic.

Produces (lo que los slices #2–#7 pasan a dar por hecho):
- Workspaces npm `server/` y `web/` con `tsconfig.base.json` compartido (TS estricto, ESM).
- Comandos raíz `npm run build`, `npm test`, `npm run lint` — exit 0 es el criterio de
  verificación de todo slice posterior.
- `server/src/app.ts` exporta `createApp(): Express` — factoría sin `listen`, testeable con
  supertest; el slice #4 le añade las rutas reales.
- Convención de tests: `*.test.ts` / `*.test.tsx` junto al código, ejecutados con
  `vitest run` por workspace.
- CI en `.github/workflows/ci.yml` que ejecuta build+test+lint en cada PR (este es el único
  slice del epic que toca CI).

## 6. Test strategy

Vitest por workspace, ejecutado con `npm test` desde la raíz:

- `server/src/app.test.ts` — TDD real (rojo → verde) sobre `GET /api/health` con supertest
  contra `createApp()`. Demuestra que Express + TS + ESM + Vitest funcionan encadenados.
- `web/src/App.test.tsx` — smoke test sin DOM: importa `App` y afirma que es una función.
  Demuestra que el pipeline TSX de Vitest funciona sin necesitar jsdom.

Las tareas 1, 4, 5 y 6 son configuración y documentación: no llevan tests unitarios porque no
introducen comportamiento que aislar. Su verificación son los comandos exactos listados en
cada una, más la verificación global. No inventes tests para ellas.

## 7. Tasks

### Task 1 — Estructura del monorepo npm workspaces

**Objective:** `npm install` en la raíz termina con exit 0 e instala los workspaces `server` y
`web` con sus dependencias declaradas.

**Files:** `.gitignore` (modificar), `package.json`, `tsconfig.base.json`,
`server/package.json`, `web/package.json` (crear), `package-lock.json` (generado).

Current state (.gitignore):

```
.worktrees/
.agent/SLICE.md
```

Final state (`.gitignore` completo — se añaden dos líneas al final):

```
.worktrees/
.agent/SLICE.md
node_modules/
dist/
```

Fichero `package.json` (raíz).

Current state: does not exist.

Final content:

```json
{
  "name": "repo-pulse",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "workspaces": [
    "server",
    "web"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "eslint": "^9.17.0",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.18.0"
  }
}
```

Fichero `tsconfig.base.json` (raíz).

Current state: does not exist.

Final content:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

Fichero `server/package.json`.

Current state: does not exist.

Final content:

```json
{
  "name": "server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^5.1.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.1",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "vitest": "^3.0.4"
  }
}
```

Fichero `web/package.json`.

Current state: does not exist.

Final content:

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit -p tsconfig.json && vite build",
    "test": "vitest run",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.5",
    "vitest": "^3.0.4"
  }
}
```

Con los cinco ficheros escritos, ejecuta `npm install` en la raíz del worktree: genera
`package-lock.json`, que se commitea tal cual. Ese lockfile es un artefacto de npm y es la
única excepción a la regla de contenido literal de este plan: no lo escribas a mano. El
commit de esta tarea incluye los cinco ficheros de arriba más `package-lock.json`.

**TDD:** No TDD — configuración de workspaces, sin comportamiento testeable unitariamente.

**Tests:** N/A — todavía no hay código; los scripts `test` quedan declarados y se ejercitan en
las tareas 2 y 3.

**Verification:** `npm install` termina con exit 0; `git status --short` lista
`package-lock.json` como fichero nuevo y NO lista `node_modules/` (lo ignora el `.gitignore`
actualizado).

### Task 2 — server: Express + TS con healthcheck (TDD)

**Objective:** `npm test --workspace server` y `npm run build --workspace server` terminan con
exit 0, con un test de `GET /api/health` en verde.

**Files:** `server/tsconfig.json`, `server/src/app.test.ts`, `server/src/app.ts`,
`server/src/index.ts` (los cuatro nuevos).

Fichero `server/tsconfig.json`.

Current state: does not exist.

Final content:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

Fichero `server/src/app.test.ts`.

Current state: does not exist.

Final content:

```ts
import { expect, test } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'

test('GET /api/health responde 200 con { status: "ok" }', async () => {
  const response = await request(createApp()).get('/api/health')

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ status: 'ok' })
})
```

Fichero `server/src/app.ts`.

Current state: does not exist.

Final content:

```ts
import express from 'express'
import type { Express } from 'express'

export function createApp(): Express {
  const app = express()

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  return app
}
```

Fichero `server/src/index.ts`.

Current state: does not exist.

Final content:

```ts
import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 3000)

createApp().listen(port, () => {
  console.log(`repo-pulse server escuchando en http://localhost:${port}`)
})
```

**TDD:** Rojo primero: crea SOLO `server/tsconfig.json` y `server/src/app.test.ts` y ejecuta
`npm test --workspace server`; confirma que falla porque no puede resolver `./app.js`. Después
crea `server/src/app.ts` tal cual está arriba y vuelve a ejecutarlo: el test
`GET /api/health responde 200 con { status: "ok" }` pasa. `server/src/index.ts` se añade al
final y no lo cubre ningún test: solo hace `listen`.

**Tests:** añadido: `server/src/app.test.ts` → `GET /api/health responde 200 con
{ status: "ok" }`. Ninguno eliminado.

**Verification:** `npm test --workspace server` → exit 0, `1 passed`.
`npm run build --workspace server` → exit 0 y `ls server/dist` lista `app.js` e `index.js`,
sin `app.test.js` (los tests están excluidos del build).

### Task 3 — web: app mínima Vite + React + TS (smoke test)

**Objective:** `npm test --workspace web` y `npm run build --workspace web` terminan con exit
0, con la app React mínima compilando y un smoke test en verde.

**Files:** `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`,
`web/src/App.test.tsx`, `web/src/App.tsx`, `web/src/main.tsx` (los seis nuevos).

Fichero `web/tsconfig.json`.

Current state: does not exist.

Final content:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

Fichero `web/vite.config.ts`.

Current state: does not exist.

Final content:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

Fichero `web/index.html`.

Current state: does not exist.

Final content:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Repo Pulse</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Fichero `web/src/App.test.tsx`.

Current state: does not exist.

Final content:

```tsx
import { expect, test } from 'vitest'
import App from './App'

test('App exporta un componente de React', () => {
  expect(typeof App).toBe('function')
})
```

Fichero `web/src/App.tsx`.

Current state: does not exist.

Final content:

```tsx
export default function App() {
  return <h1>Repo Pulse</h1>
}
```

Fichero `web/src/main.tsx`.

Current state: does not exist.

Final content:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**TDD:** Rojo primero: crea `web/tsconfig.json`, `web/vite.config.ts` y
`web/src/App.test.tsx` y ejecuta `npm test --workspace web`; confirma que falla porque no
puede resolver `./App`. Crea `web/src/App.tsx` tal cual: el test
`App exporta un componente de React` pasa. `web/index.html` y `web/src/main.tsx` se añaden
después; los cubre el build, no el test.

**Tests:** añadido: `web/src/App.test.tsx` → `App exporta un componente de React`. Es un
smoke test deliberadamente sin DOM (sin jsdom): el render real llega con el slice #5. Ninguno
eliminado.

**Verification:** `npm test --workspace web` → exit 0, `1 passed`.
`npm run build --workspace web` → exit 0 (typecheck con `tsc --noEmit` más `vite build`, que
genera `web/dist/`).

### Task 4 — ESLint flat config en la raíz

**Objective:** `npm run lint` en la raíz termina con exit 0 linteando los dos workspaces.

**Files:** `eslint.config.js` (nuevo).

Fichero `eslint.config.js` (raíz).

Current state: does not exist.

Final content:

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
)
```

Si `npm run lint` reporta errores en los ficheros de las tareas 1–3, NO relajes reglas ni
añadas comentarios de desactivación de ESLint: corrige el código y comprueba que build y
tests siguen en verde. Con el código literal de este plan no se esperan errores.

**TDD:** No TDD — configuración de lint, sin comportamiento propio.

**Tests:** N/A — lo verifica el propio comando de lint.

**Verification:** `npm run lint` → exit 0, sin errores ni warnings. Comprobación de que de
verdad lintea el código TS/TSX: `npx eslint server/src/app.ts web/src/App.tsx` → exit 0 sin
quejas de parser.

### Task 5 — CI en GitHub Actions

**Objective:** cada PR, y cada push a `main`, ejecuta build+test+lint en GitHub Actions.

**Files:** `.github/workflows/ci.yml` (nuevo).

Fichero `.github/workflows/ci.yml`.

Current state: does not exist.

Final content:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run lint
```

**TDD:** No TDD — configuración de CI; la prueba real es su ejecución en el PR.

**Tests:** N/A — la verificación definitiva es el check verde en el PR de este slice.

**Verification:** `node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')"`
→ exit 0 (el fichero existe y se lee); `npx --yes js-yaml .github/workflows/ci.yml` → exit 0,
el YAML parsea. Que el workflow corra en verde se comprueba en la verificación global, al
abrir el PR: no bloquea el commit de esta tarea.

### Task 6 — AGENTS.md con los comandos reales

**Objective:** AGENTS.md documenta setup, build, test y lint reales sin tocar la sección
protegida del contrato de slices.

**Files:** `AGENTS.md` — SOLO los tres tramos citados abajo. Desde la línea que empieza por
`## Formato de la tabla de slices` hasta el final del fichero, y los dos marcadores
`ct-init:slices-contract` que la preceden, no se modifica ni un byte.

Las tres citas de AGENTS.md de esta tarea son HISTÓRICAS: son el estado del
fichero ANTES de este slice (commit base `b4ebcd9`), y esta tarea es justo la que
las reescribe, así que dejan de existir verbatim en cuanto se ejecuta. Se
etiquetan como tal a propósito, y cualquiera puede comprobarlas con
`git show b4ebcd9:AGENTS.md`.

Reemplazo A — de `## Project overview` a `## Project layout` (ambas incluidas).

Estado de AGENTS.md antes de este slice (`b4ebcd9`, líneas 3-23):

```
## Project overview
`repo-pulse` — repo recién creado (solo `README.md`). Todavía no hay código,
stack ni propósito definidos más allá del nombre. Remoto:
`github.com/jjponz/repo-pulse`.

## Setup commands
Ninguno todavía: no hay toolchain (ni `package.json`, ni `pyproject.toml`,
ni `Makefile`…). Actualiza esta sección cuando el primer slice traiga el stack.

## Build, test & lint
No existen aún comandos de build, test ni lint, y **no hay CI configurada**
(sin `.github/workflows/`). El slice que introduzca el stack debe:
1. dejar aquí los comandos reales (build/test/lint), y
2. añadir el workflow de CI que los ejecute.
Hasta entonces, "verificar" un slice = lo que declare su issue.

## Code style & conventions
Sin convenciones establecidas. Las fija el primer código que entre; escríbelas
aquí cuando existan.

## Project layout
```

Ese tramo pasa a ser exactamente:

```
## Project overview
`repo-pulse` — dashboard local de salud de repos git (Pulso, Gente, Calor).
Monorepo npm workspaces: `web/` (Vite + React + TS) y `server/` (Express + TS).
Remoto: `github.com/jjponz/repo-pulse`.

## Setup commands
- Node ≥22 y npm ≥10.
- `npm install` en la raíz instala los dos workspaces (`server/`, `web/`).

## Build, test & lint
Desde la raíz; cada comando cubre ambos workspaces:
- `npm run build` — `server/`: `tsc` → `dist/`; `web/`: `tsc --noEmit` + `vite build`.
- `npm test` — Vitest (`vitest run`) en cada workspace.
- `npm run lint` — ESLint 9 (flat config en `eslint.config.js`) sobre todo el repo.
La CI (`.github/workflows/ci.yml`) ejecuta build+test+lint en cada PR y en cada
push a `main`.

## Code style & conventions
- TypeScript estricto (`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`); ESM en todo el repo (`"type": "module"`).
- ESLint flat config: `@eslint/js` recommended + `typescript-eslint` recommended.
- Tests con Vitest junto al código: `*.test.ts` / `*.test.tsx`.
- En `server/` los imports relativos llevan sufijo `.js` (ESM + NodeNext).

## Project layout
```

Reemplazo B — las tres líneas de dentro del bloque de código de "Project layout" (las líneas
entre sus dos vallas de backticks, que se dejan intactas).

Estado de AGENTS.md antes de este slice (`b4ebcd9`, líneas 25-27):

```
README.md          # único contenido por ahora
.agent/STATE.md    # estado de la sesión coordinadora (no es producto)
AGENTS.md          # esta guía
```

Esas tres líneas pasan a ser exactamente:

```
server/            # API Express + TS (build → server/dist/)
web/               # UI Vite + React + TS
docs/              # specs, planes y maqueta de referencia
.github/workflows/ # CI: build+test+lint en cada PR
.agent/STATE.md    # estado de la sesión coordinadora (no es producto)
AGENTS.md          # esta guía
```

Reemplazo C — la sección "Gotchas" completa.

Estado de AGENTS.md antes de este slice (`b4ebcd9`, líneas 49-51):

```
## Gotchas
- Repo vacío: cualquier verificación de "los tests pasan" es vacua hasta que
  exista una suite. No lo declares como comprobado.
```

Pasa a ser exactamente:

```
## Gotchas
- `vitest run` falla (exit 1) si un workspace se queda sin ficheros de test: no
  borres el último test de un workspace sin sustituirlo.
- Los `*.test.ts` de `server/` están excluidos del build de `tsc`: un error de
  tipos en un test no rompe `npm run build`. No te fíes solo del build.
```

Todo lo demás del fichero (secciones "Workflow", "Commit & PR rules", "Security & data
handling", "Do NOT touch", "Skills" y el contrato de slices hasta el final) queda byte a byte
como está.

**TDD:** No TDD — documentación.

**Tests:** N/A — documentación.

**Verification:** `git diff --unified=0 AGENTS.md | grep '^@@'` muestra hunks SOLO en los
tramos 3–23, 25–27 y 49–51 del fichero original;
`grep -c 'ct-init:slices-contract' AGENTS.md` sigue dando `2` y
`grep -n '^## Formato de la tabla de slices' AGENTS.md` sigue encontrando la sección;
`grep -n 'npm run build\|npm test\|npm run lint' AGENTS.md` encuentra los tres comandos.

## 8. Global verification

Con las seis tareas commiteadas, simula un checkout limpio y ejecuta los criterios de
aceptación literales del issue desde la raíz del worktree:

```bash
rm -rf node_modules server/node_modules web/node_modules server/dist web/dist
npm ci
npm run build && npm test && npm run lint; echo "exit=$?"
```

Se espera `exit=0` (AC 1). Después, abrir el PR contra `main` con `Closes #1` en el cuerpo y
comprobar que el workflow `CI` corre build+test+lint y termina en verde (AC 2). AC 3 se revisa
leyendo AGENTS.md en el diff del PR.

## 9. Assumptions

1. **Versiones de dependencias** — el issue no las fija; se eligen rangos caret de versiones
   estables conocidas (Express 5, React 19, Vite 6, Vitest 3, ESLint 9, TypeScript 5.7) y npm
   resuelve el último parche compatible al generar el lockfile. *(Own call.)*
2. **Endpoint `/api/health`** — el issue no pide rutas; se añade como mínimo verificable de
   que Express + TS + Vitest funcionan (el slice es un "esqueleto"). La API real llega con el
   slice #4. *(Own call, alineado con el "Enfoque técnico" del epic.)*
3. **`package-lock.json` sin contenido literal en el plan** — es un artefacto generado por
   `npm install`; transcribirlo a mano sería inventarlo. Se genera y se commitea tal cual.
   *(Own call.)*
4. **La CI dispara también en push a `main`** — el AC solo exige PRs; añadir el push a `main`
   da baseline verde post-merge sin coste. *(Own call.)*
5. **`typescript` y ESLint declarados solo en la raíz** — npm workspaces hoistea los
   binarios, así que `tsc` y `eslint` resuelven desde cualquier workspace y hay UNA sola
   versión de TypeScript en el monorepo. *(Own call.)*
6. **Smoke test de `web/` sin jsdom** — renderizar de verdad exigiría jsdom o
   testing-library, que no aportan nada al esqueleto; llegan cuando haya UI real (#5).
   *(Own call.)*
7. **Textos en español** en la UI (`title`, `h1`) y en los logs del servidor — "Textos de UI
   en español, como la maqueta". *(Contexto del epic.)*
8. **AGENTS.md: se actualizan también overview, layout, code style y gotchas** — el AC solo
   exige documentar los comandos, pero las secciones vecinas quedarían mintiendo ("repo
   recién creado", "sin convenciones establecidas") y esas mismas secciones piden
   actualizarse cuando el primer slice traiga el stack. *(Repo convention.)*
9. **Node ≥22** — declarado en `engines` y usado en la CI (`node-version: 22`). *(Contexto
   del epic: "Node ≥22".)*
