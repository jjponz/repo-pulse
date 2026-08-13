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
you_are_here: "Slice #1 (esqueleto) entregado y EN REVIEW (2026-08-13): el agente cerró el gate plan, abrió el PR #8 (feat/1 → main, no draft, CI verde) y liberó su claim — issue #1 en status:in-review, sin sesión abierta (normal en in-review, no es anomalía). Issues #2–#7 siguen en backlog: no hay nada más en vuelo."
next_action: "Cerrar el gate apply del #1: revisar el PR #8 y mergearlo (el loop NO lo impide, el que cierra el gate eres tú); luego cerrar el issue #1 y promover a status:ready el siguiente slice para despacharlo con /ct-next"
# blocked: null = NO bloqueado. Si el trabajo no puede continuar (una decisión
# lo paró, el plan resultó falso, falta algo de fuera), NO lo escribas en prosa
# dentro de next_action: ponlo aquí. El hook de SessionStart lo anuncia al
# arrancar cualquier sesión de este repo y SUSPENDE el next_action.
#   blocked: {reason: "por qué no se puede continuar", unblock: "qué haría falta para levantarlo", since: "2026-07-25"}
# Levantarlo es borrar el campo (o volver a null): una decisión deliberada.
blocked: null
# verify: la comprobación PENDIENTE que valida este trabajo AL TERMINAR — nunca
# un hecho ya comprobado, aunque se redacte en presente.
verify: "gh pr view 8 --json state,mergedAt sale MERGED y gh issue view 1 sale CLOSED sin status:in-review"
tasks: []
---
## Current State
Epic groomeado (milestone + issues #1–#7 + labels + Project v2). Slice #1
(esqueleto: monorepo npm workspaces con CI) implementado en .worktrees/1 sobre
la rama feat/1 y entregado como PR #8, abierto y pendiente de mi review. CI del
PR en verde. Nada más en vuelo: #2–#7 en status:backlog.
## Immediate Next Steps
1. Revisar el PR #8 y cerrar el gate apply (mergear).
2. Cerrar el issue #1 y limpiar su label status:in-review.
3. Elegir el siguiente slice de #2–#7, promoverlo a status:ready y correr /ct-next.
## Decisions Made
## Gotchas/Constraints
- `/ct-next` en este repo necesita `CT_ACCOUNT_PERSONAL_DIR=$HOME/.claude` y
  `CT_AGENT_BIN_PERSONAL=claude`: no existen ni `~/.claude-personal` ni el
  binario `claude-personal`.
- Los labels `gate:plan`/`gate:apply` del issue marcan qué gates aplican, no si
  están cerrados: siguen puestos aunque el gate ya se haya pasado.
## Critical Files
