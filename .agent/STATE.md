---
task: "Epic Repo Pulse MVP: brainstorming → spec → loop"
# role: quién eres en el loop. Hay DOS sesiones vivas por repo con papeles
# opuestos, y hasta F20 el reparto solo estaba escrito dentro del kickoff que
# recibía una de ellas — se perdía en cuanto esa sesión se re-hidrataba.
#   - Este fichero es el del CHECKOUT PRINCIPAL: quien trabaja aquí es la
#     sesión COORDINADORA (corre /ct-groom y /ct-next, revisa y mergea PRs).
#   - Cada slice despachado tiene el suyo en .worktrees/<n>/.agent/SLICE.md
#     (F22 — antes era STATE.md, que es el de la coordinadora, no el del
#     slice), con role: slice-agent — implementa ese slice y para.
# Ningún código decide nada con este campo: es para el agente que lo lee.
role: "coordinador (checkout principal): groomeas, despachas con /ct-next, revisas y mergeas. NO implementas slices aquí — eso pasa en .worktrees/<n>."
status: in_progress
branch: ""
base: main
# last_commit: el último commit DE TRABAJO de este slice. El hook de Stop
# bloquea el cierre de turno si hay trabajo por encima de él sin registrar —
# pero un commit que solo toca este fichero NO cuenta, así que commitear la
# actualización de STATE.md no te vuelve a dejar atrás.
last_commit: ""
github_issue: null
you_are_here: "Slice #1 cerrado (PR #8 en squash, 9824d3d) y cosechado. Slice #2 (análisis: pulso y gente) en vuelo en .worktrees/2 sobre feat/2: publicó su plan en el issue (2 comentarios, 74 KB, commiteado en la rama y validado con --check-plan) y el GATE PLAN SE CERRÓ con un 'ok' en el hilo el 2026-08-13 a las 15:45. El agente está implementando sus 8 tareas. Cap 1/1 ocupado; #3–#7 en status:backlog."
next_action: "Esperar el PR del #2 contra main (el kickoff le exige 'Closes #2' en el CUERPO) y su release a status:in-review; entonces revisarlo, cerrar el gate apply y mergear"
# blocked: null = NO bloqueado. Si el trabajo no puede continuar (una decisión
# lo paró, el plan resultó falso, falta algo de fuera), NO lo escribas en prosa
# dentro de next_action: ponlo aquí. El hook de SessionStart lo anuncia al
# arrancar cualquier sesión de este repo y SUSPENDE el next_action.
#   blocked: {reason: "por qué no se puede continuar", unblock: "qué haría falta para levantarlo", since: "2026-07-25"}
# Levantarlo es borrar el campo (o volver a null): una decisión deliberada.
blocked: null
# verify: la comprobación PENDIENTE que valida este trabajo AL TERMINAR — nunca
# un hecho ya comprobado, aunque se redacte en presente.
verify: "el PR del #2 llega contra main con 'Closes #2' en el cuerpo, CI verde, y el diff no toca app.ts/index.ts/app.test.ts ni web/ (la frontera que el propio plan declara)"
tasks: []
---
## Current State
Epic groomeado (milestone + issues #1–#7 + labels + Project v2). Slice #1
(esqueleto: monorepo npm workspaces con CI) mergeado y cosechado. Slice #2
(análisis: pulso y gente) en vuelo desde 2026-08-13: agente vivo en
.worktrees/2 sobre feat/2, parado en el gate plan por diseño. #3–#7 en
status:backlog. El cap está lleno (1/1): no despachar otro hasta cerrar el #2.
## Immediate Next Steps
1. Esperar el PR del #2 y su paso a status:in-review.
2. Revisarlo contra el verify de arriba, cerrar el gate apply y mergear.
3. Cosechar .worktrees/2 y feat/2, y promover el siguiente slice (#3 o #4).
## Decisions Made
- Gate plan del #2 cerrado con OK (2026-08-13 15:45). Con él se sancionaron tres
  cosas que el issue NO pedía y que el plan añade con motivo: partir el tsconfig
  de `server/` en typecheck (todo `src`) + emit (sin tests), que AGENTS.md asigna
  a este slice; exportar `cubosVentanaAnterior`, `leerHeadSha` y `ruido.ts` para
  los slices de API y Calor; y fijar ventanas de 30/91/364 días en UTC, que el
  issue deja abiertas. Si un slice posterior las contradice, la fuente es esta
  decisión, no el issue.
- Gate apply del #1 cerrado a mano (2026-08-13): el slice no toca ningún entorno
  real —sin deploy ni apply ni scripts contra datos—, y la evidencia fue el CI
  en verde del PR más la cadena npm ci/build/test/lint corrida en local sobre un
  checkout limpio.
## Gotchas/Constraints
- `/ct-next` en este repo necesita `CT_ACCOUNT_PERSONAL_DIR=$HOME/.claude` y
  `CT_AGENT_BIN_PERSONAL=claude`: no existen ni `~/.claude-personal` ni el
  binario `claude-personal`.
- Los labels `gate:plan`/`gate:apply` del issue marcan qué gates aplican, no si
  están cerrados: siguen puestos aunque el gate ya se haya pasado. Lo mismo con
  el `status:in-review` de un issue ya cerrado: no es anomalía, y `/ct-next` lo
  dice en cada corrida.
- Un hook local bloquea CUALQUIER `git push` mientras el checkout principal está
  en `main` (rama protegida) — incluido un `git push origin --delete <rama>`,
  que no toca main: lo que mira es la rama en la que estás, no la forma del
  comando. Desde una rama de trabajo pasa (verificado con `chore/state`), así
  que los commits de este fichero salen por PR; y una rama remota se puede
  borrar sin git con `gh api -X DELETE repos/<owner>/<repo>/git/refs/heads/<r>`.
- `ACCOUNT_MAP` (scripts/kickoff.js del plugin) no tiene patrón para `jjponz/*`:
  el dispatcher cae a la cuenta personal por defecto, que aquí es la correcta.
## Critical Files
