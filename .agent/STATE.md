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
you_are_here: "Slice #1 (esqueleto) CERRADO (2026-08-13): gate apply cerrado a mano en el issue #1 con evidencia (CI verde + cadena npm ci/build/test/lint verificada en local), PR #8 mergeado en squash (9824d3d) e issue #1 cerrado automáticamente. Su label status:in-review sigue puesto sobre el issue cerrado: NO es anomalía, un issue cerrado se cae de la cola igualmente. Nada en vuelo: #2–#7 en status:backlog."
next_action: "Elegir el siguiente slice (orden §9 del spec: #2 análisis pulso y gente), promoverlo a status:ready y despacharlo con /ct-next (con CT_ACCOUNT_PERSONAL_DIR/CT_AGENT_BIN_PERSONAL, ver gotchas); después, gate plan del slice despachado"
# blocked: null = NO bloqueado. Si el trabajo no puede continuar (una decisión
# lo paró, el plan resultó falso, falta algo de fuera), NO lo escribas en prosa
# dentro de next_action: ponlo aquí. El hook de SessionStart lo anuncia al
# arrancar cualquier sesión de este repo y SUSPENDE el next_action.
#   blocked: {reason: "por qué no se puede continuar", unblock: "qué haría falta para levantarlo", since: "2026-07-25"}
# Levantarlo es borrar el campo (o volver a null): una decisión deliberada.
blocked: null
# verify: la comprobación PENDIENTE que valida este trabajo AL TERMINAR — nunca
# un hecho ya comprobado, aunque se redacte en presente.
verify: "el siguiente slice sale de /ct-next con claim in-progress, worktree y agente vivo, y su plan llega como comentario del issue"
tasks: []
---
## Current State
Epic groomeado (milestone + issues #1–#7 + labels + Project v2). Slice #1
(esqueleto: monorepo npm workspaces con CI) entregado y mergeado: PR #8 en
squash sobre main (9824d3d), issue #1 cerrado. Quedan #2–#7 en status:backlog y
nada en vuelo, así que el loop está parado hasta que promueva el siguiente.
## Immediate Next Steps
1. Promover el siguiente slice a status:ready (orden §9: #2) y correr /ct-next.
2. Retirar el worktree .worktrees/1 y la rama feat/1, ya mergeados.
3. Gate plan del slice despachado: revisar su comentario de plan y responder OK.
## Decisions Made
- Gate apply del #1 cerrado a mano (2026-08-13): el slice no toca ningún entorno
  real —sin deploy ni apply ni scripts contra datos—, y la evidencia fue el CI
  en verde del PR más la cadena npm ci/build/test/lint corrida en local sobre un
  checkout limpio.
## Gotchas/Constraints
- `/ct-next` en este repo necesita `CT_ACCOUNT_PERSONAL_DIR=$HOME/.claude` y
  `CT_AGENT_BIN_PERSONAL=claude`: no existen ni `~/.claude-personal` ni el
  binario `claude-personal`.
- Los labels `gate:plan`/`gate:apply` del issue marcan qué gates aplican, no si
  están cerrados: siguen puestos aunque el gate ya se haya pasado.
## Critical Files
