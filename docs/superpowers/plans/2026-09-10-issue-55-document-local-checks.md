# #55 — CT-138 smoke A: documentar los controles locales en `docs/verification/`

> **This plan is written to be executed by task-scoped subagents that arrive with zero context
> and decide nothing.** Every task carries the current state of what it touches (copied
> verbatim), the contracts it honours and the exact commands that verify it; its bodies are
> yours to write, test-first. Names, signatures, constants and test names come from this
> document, which decided them. On ambiguity, the issue body and AGENTS.md win.

## 1. Context and goal

Hoy el repositorio declara sus controles locales en un único sitio: la sección
`## Build, test & lint` de `AGENTS.md` (líneas 16-24), que nombra `npm run build`, `npm test` y
`npm run lint`, y la sección `## Setup commands` (líneas 8-14), que fija Node ≥22 con
`engines.node` del `package.json` de la raíz como fuente de verdad. Los scripts reales viven en
`package.json` (`build`: `npm run build --workspaces`, `test`: `npm run test --workspaces`,
`lint`: `eslint .`) y la CI (`.github/workflows/ci.yml`) los ejecuta con `npm ci` y
`node-version: 22`. El directorio `docs/` guarda specs, planes y la maqueta; `docs/verification/`
no existe todavía.

Este slice es una verificación desechable de punta a punta de Control Tower sobre este
repositorio: crea un único documento, `docs/verification/ct-138-local-checks.md`, que reúne el
requisito de Node.js y los comandos exactos de instalación, build, test y lint tal como los
declaran el `package.json` de la raíz y `AGENTS.md`. No hay ticket detrás y no hay código que
cambiar.

### Desired end state

El issue no declara criterios de aceptación (su sección trae el marcador `(fill in from the
spec)`), así que los propone este plan a partir del «Comentario de quien pide el plan»:

- Existe `docs/verification/ct-138-local-checks.md`, escrito en español, y es el único fichero
  que el slice añade.
- El documento declara el requisito de Node.js ≥22 y nombra `engines.node` del `package.json` de
  la raíz como fuente de verdad.
- El documento lista los cuatro comandos, desde la raíz: `npm install`, `npm run build`,
  `npm test` y `npm run lint`, cada uno con lo que ejecuta de verdad según el `package.json` de
  la raíz.
- El documento dice de forma explícita que esos comandos son instrucciones para ejecutar desde
  la raíz del repositorio, y **no** evidencia de que se hayan ejecutado ni de que hayan pasado.
- Ningún otro fichero del repositorio cambia: ni código de aplicación, ni configuración, ni
  tests existentes, ni `README.md`, ni `AGENTS.md`.

### Out of scope

La sección "Out of scope / Protected" del issue declara `(none declared)`, pero el comentario de
quien pide el plan sí protege: **no se toca** código de aplicación (`server/`, `web/`),
configuración (`package.json`, `package-lock.json`, `eslint.config.js`, `tsconfig.base.json`,
`.github/`), tests existentes, `README.md` ni `AGENTS.md`. Tampoco se documenta nada más que el
requisito de Node.js y esos cuatro comandos: ni el arranque en desarrollo (`npm run dev`), ni las
variables `REPO_PULSE_ROOT` / `REPO_PULSE_DATA_DIR`, ni la CI como procedimiento. El plan se
queda en una sola tarea de documentación. El pull request resultante **no se mergea nunca**.

## 2. Closed decisions (take as given)

| Decision | Value |
|---|---|
| Ruta y nombre del fichero | `docs/verification/ct-138-local-checks.md`, exactamente; el directorio `docs/verification/` se crea con él |
| Idioma del documento | español: es documentación que lee una persona, y `AGENTS.md` («Code style & conventions») pone ahí la frontera. `conventions/style.md` exige inglés para identificadores y no habla de la prosa de un `.md`, así que no hay choque |
| Fuente del requisito de Node | `engines.node` del `package.json` de la raíz (`">=22"`), citado como fuente de verdad; la CI fija `node-version: 22` |
| Fuente de los comandos | los scripts del `package.json` de la raíz, con su valor literal: `npm run build --workspaces`, `npm run test --workspaces`, `eslint .` |
| Comando de instalación | `npm install` en la raíz para local; se menciona que la CI usa `npm ci` |
| Ficheros que el slice añade | uno y solo uno: el documento. Nada de índices, enlaces desde `README.md` ni entradas en `AGENTS.md` |
| Nota de «instrucciones, no evidencia» | va en el propio documento, pegada a la lista de comandos, y niega las dos cosas por separado: que se hayan ejecutado y que hayan pasado (revisión humana del plan) |
| Número de tareas | una: lo pide el comentario de quien pide el plan («Keep the plan to one small documentation task») |

## 3. Reference patterns

Files to imitate: `docs/superpowers/plans/2026-08-17-issue-5-ui-shell-y-pulso.md` (documentación
del repositorio en español, con comandos entre backticks), `AGENTS.md` (secciones cortas con
lista de comandos, una por línea, y el porqué inline).

Rules to obey: `AGENTS.md` — la frontera de idioma («si lo lee un compilador, inglés; si lo lee
una persona como producto o como conversación, español»), la sección `## Build, test & lint`
como origen literal de los comandos, `## Setup commands` como origen del requisito de Node, la
sección `## Do NOT touch` y las reglas de commit y PR. Ese es el único documento de
convenciones que declara este repositorio.

## 4. Inventory

| File | Action | Consumed by | Block in §7 |
|---|---|---|---|
| `docs/verification/ct-138-local-checks.md` | create | una persona que arranca el repo en local | Final text (Task 1) |

## 5. Interfaces

Consumes: N/A — el issue no declara sección "Dependencias" y el slice no consume ninguna
interfaz de código.
Produces: N/A — documentación; no exporta ningún símbolo del que pueda depender otro slice.

## 6. Test strategy

N/A — sin tests, y es deliberado. El slice no añade ni cambia comportamiento: su entregable es
prosa, y no hay nada que poner en rojo antes de escribirla. La verificación es de contenido
(predicados `grep` sobre el fichero creado) y de perímetro (predicado `git diff` que prueba que
no se tocó nada protegido). La suite existente (`npm test`) no se ejecuta como control del slice
porque un `.md` nuevo no puede alterarla: el predicado del perímetro es la prueba más fuerte de
eso, y el baseline de este worktree está declarado **no-verificado** en `.agent/SLICE.md`.

## 7. Tasks

### Task 1 — el documento de controles locales

**Objective:** una persona que arranca `repo-pulse` en local encuentra en un solo documento el
requisito de Node.js y los cuatro comandos exactos.

**Files:** `docs/verification/ct-138-local-checks.md` (create)

Final text (docs/verification/ct-138-local-checks.md):

```md
## Requisito de Node.js
Node.js ≥22. La fuente de verdad es `engines.node` del `package.json` de la
raíz (`">=22"`); la CI fija `node-version: 22`.

## Comandos, desde la raíz del repositorio
- `npm install` — instala los dos workspaces (`server/` y `web/`); la CI usa `npm ci`.
- `npm run build` — `npm run build --workspaces`.
- `npm test` — `npm run test --workspaces`.
- `npm run lint` — `eslint .`.

> Son instrucciones para ejecutar desde la raíz, no evidencia: este documento
> no afirma que se hayan ejecutado ni que hayan pasado.
```

Alrededor de ese bloque, y en español: un título `# Controles locales de repo-pulse`, una
entradilla de dos o tres líneas que diga que son las comprobaciones que se pasan en local antes
de abrir un pull request y que la CI (`.github/workflows/ci.yml`) ejecuta las mismas en cada
pull request y en cada push a `main`, y una línea que remita a `## Build, test & lint` de
`AGENTS.md` como guía durable. Nada más: sin apartado de desarrollo, sin variables de entorno y
sin procedimiento de CI. La nota del bloque va literal: es lo que pidió la revisión del plan.

**TDD:** No TDD — es documentación: no hay comportamiento que poner en rojo.

**Tests:** N/A — no hay código nuevo.

**Verification:** los seis, exit 0. Los dos primeros prueban que el documento existe y que
nombra los cuatro comandos, uno por línea; el tercero, que declara el requisito de Node por su
fuente de verdad; el cuarto, que la nota de la revisión está ahí y niega las dos cosas
(ejecutado ni pasado); el quinto, que lo que dice de los scripts sigue siendo cierto en el
`package.json` de la raíz (ejecutado hoy contra el árbol: exit 0); el sexto, que el slice no ha
tocado nada protegido desde la base de la rama (`5b2ccb1`) — ejecutado hoy, exit 0.

```bash
test -f docs/verification/ct-138-local-checks.md   # expected: exit 0 — el fichero existe
test "$(grep -cE '^- `npm (install|run build|test|run lint)`' docs/verification/ct-138-local-checks.md)" -eq 4   # expected: exit 0 — los cuatro comandos, uno por línea
test "$(grep -c 'engines.node' docs/verification/ct-138-local-checks.md)" -eq 1   # expected: exit 0 — la fuente de verdad de Node, nombrada una vez
test "$(grep -c 'no evidencia' docs/verification/ct-138-local-checks.md)" -eq 1 && test "$(grep -c 'se hayan ejecutado ni que hayan pasado' docs/verification/ct-138-local-checks.md)" -eq 1   # expected: exit 0 — la nota está y niega ejecución y resultado
test "$(grep -c '"lint": "eslint \."' package.json)" -eq 1   # expected: exit 0 — lo que el documento dice de `npm run lint` sigue siendo cierto
test -z "$(git diff --name-only 5b2ccb19753c4c96a4d31028d25de36c2dcce676..HEAD -- AGENTS.md README.md package.json package-lock.json eslint.config.js tsconfig.base.json server web .github)"   # expected: exit 0 — nada protegido ha cambiado
```

## 8. Global verification

Con la única tarea commiteada, desde la raíz. El primer predicado prueba que el slice añadió
exactamente un fichero sobre la base de la rama además del propio plan; el segundo, que ese
fichero es el documento; el tercero, que el árbol queda limpio. Los tres los he ejecutado hoy
contra el árbol de trabajo con el resultado que esperan una vez la tarea esté commiteada, salvo
el primero, que hoy cuenta solo el plan.

`npm run build`, `npm test` y `npm run lint` no entran como control de este slice: el diff no
sale de `docs/**.md`, y eso es justo lo que mide el segundo predicado. El baseline de este
worktree está declarado **no-verificado** en `.agent/SLICE.md`, así que un verde suyo aquí no
mediría el slice sino el estado previo del repositorio.

```bash
test "$(git diff --name-only 5b2ccb19753c4c96a4d31028d25de36c2dcce676..HEAD | wc -l)" -eq 2   # expected: exit 0 — el plan y el documento, nada más
test -z "$(git diff --name-only 5b2ccb19753c4c96a4d31028d25de36c2dcce676..HEAD | grep -v '^docs/')"   # expected: exit 0 — todo el diff vive en docs/
test -z "$(git status --porcelain)"   # expected: exit 0 — nada sin commitear
```

## 9. Assumptions

1. **El issue no declara criterios de aceptación** (`- (fill in from the spec)`) y sí trae
   «Comentario de quien pide el plan». Tomo ese comentario como toda la entrada y propongo los
   criterios en `### Desired end state`. Procedencia: instrucción del arranque de la sesión.
2. **Idioma del documento: español.** El comentario lo pide explícitamente y `AGENTS.md` lo
   confirma para lo que lee una persona. `conventions/style.md` de ct exige inglés para
   identificadores, comentarios, nombres de test y mensajes de diagnóstico, no para la prosa de
   un `.md`, y excluye expresamente el texto que lee una persona: no hay choque que declarar.
   Procedencia: issue + convención del repositorio + `conventions/style.md`.
3. **El nombre del fichero ya viene en inglés** (`ct-138-local-checks.md`), fijado por el issue,
   así que la regla de nombres de `conventions/style.md` tampoco choca con nada.
   Procedencia: issue.
4. **«Los comandos exactos … del `package.json` de la raíz y de `AGENTS.md`»** los interpreto
   como los cuatro de la superficie de la raíz —`npm install`, `npm run build`, `npm test`,
   `npm run lint`—, no los scripts internos de cada workspace (`vitest run`, `tsc -p …`,
   `vite build`), que `AGENTS.md` ya explica y que el documento no necesita repetir.
   Procedencia: decisión propia, apoyada en `## Build, test & lint` de `AGENTS.md`.
5. **`docs/verification/` es un directorio nuevo** y se crea con este único fichero. No añado
   índice ni enlace desde `README.md`: el comentario protege `README.md`.
   Procedencia: issue + estado del repositorio.
6. **La suite no se ejecuta como control del slice.** Ver §6 y §8: el baseline está
   no-verificado y el diff no sale de `docs/`. Procedencia: `.agent/SLICE.md` + decisión propia.
7. **La nota de «instrucciones, no evidencia»** la pidió una persona al revisar este plan, con
   el alcance intacto: sigue siendo una sola tarea documental y un solo fichero. La escribo en
   el documento (no en el plan) porque quien la tiene que leer es quien abre el documento.
   Procedencia: revisión humana del plan (2026-09-10).
8. **Sin tests y sin TDD**, declarado en la tarea con `No TDD — …`: no hay comportamiento.
   Procedencia: decisión propia.
