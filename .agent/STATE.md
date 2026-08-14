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
you_are_here: "Slices #1 y #2 cerrados y cosechados: #1 por PR #8 en squash (9824d3d) y #2 por PR #10 en squash (46a52c0, mergeado el 2026-08-14 a las 10:42, CI en verde y frontera respetada). De #2 ya no queda residuo: .worktrees/2 borrado, rama local feat/2 borrada. Cap 0/1 LIBRE; #3–#7 en status:backlog. El #3 (análisis: calor) es el siguiente en orden §9 y su única dependencia (#2) está mergeada; el #4 (API HTTP) depende de #2 y #3, así que todavía no es candidato."
next_action: "Despachar el #3 (análisis: calor) con /ct-next y el env de los gotchas; luego atender su gate plan (que NO despierta al agente solo: hay que empujarlo por cmux)"
# blocked: null = NO bloqueado. Si el trabajo no puede continuar (una decisión
# lo paró, el plan resultó falso, falta algo de fuera), NO lo escribas en prosa
# dentro de next_action: ponlo aquí. El hook de SessionStart lo anuncia al
# arrancar cualquier sesión de este repo y SUSPENDE el next_action.
#   blocked: {reason: "por qué no se puede continuar", unblock: "qué haría falta para levantarlo", since: "2026-07-25"}
# Levantarlo es borrar el campo (o volver a null): una decisión deliberada.
blocked: null
# verify: la comprobación PENDIENTE que valida este trabajo AL TERMINAR — nunca
# un hecho ya comprobado, aunque se redacte en presente.
verify: "el plan del #3 aparece como comentario de su issue y, tras el OK, su PR contra main llega con 'Closes #3' en el cuerpo y CI verde"
tasks: []
---
## Current State
Epic groomeado (milestone + issues #1–#7 + labels + Project v2). Dos slices
entregados: #1 (esqueleto: monorepo npm workspaces con CI) y #2 (análisis:
pulso y gente, `server/src/analysis/` — walkHistory, leerHeadSha, ruido.ts y
los tipos que consumirán Calor y la API). Ambos cosechados. Ningún agente en
vuelo: el cap está libre (0/1). #3–#7 en status:backlog.
## Immediate Next Steps
1. Despachar el #3 (análisis: calor) con /ct-next.
2. Verificar por cmux que el agente arrancó de verdad, no solo la ventana.
3. Atender su gate plan: revisar el plan en el issue, responder OK y EMPUJARLO
   a mano por cmux (responder en GitHub no lo despierta).
## Decisions Made
- Slice #2 cerrado el 2026-08-14 sin gate apply: su issue no lleva la label
  `gate:apply` (solo `gate:plan`, cerrado el 13), y el slice no toca ningún
  entorno real. La evidencia del merge fue `ci pass` en el PR #10, `Closes #2`
  en el cuerpo, y un diff que no roza app.ts/index.ts/app.test.ts ni web/.
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
- EL AGENTE DEL SLICE EDITA ESTE FICHERO dentro de su PR (el #2 lo hizo). Si la
  coordinadora tenía commits de STATE.md en `main` sin pushear, el squash los
  trae de vuelta y `main` queda «ahead N, behind 1» con el MISMO contenido por
  las dos vías. Antes de rebasar, comparar el fichero:
      git diff --quiet <local> <origin/main> -- .agent/STATE.md
  Si son idénticos, `git reset --hard origin/main` no pierde nada y evita un
  conflicto tonto. Si difieren, ahí sí hay que fusionar a mano.
- CERRAR UN GATE NO REANUDA AL AGENTE. El agente para en el gate y se queda
  IDLE en su sesión cmux; nada consulta el hilo del issue, así que responder
  'ok' en GitHub no le llega. Hay que empujarlo a mano:
      cmux workspace list                       # localiza el workspace del slice
      cmux send --workspace workspace:<n> "<el OK y qué debe hacer>"
      cmux send-key --workspace workspace:<n> Enter
  Los DOS comandos: `send` solo escribe en el prompt, deja el texto sin enviar
  (el `\n` que documenta su ayuda no lo envió aquí). Comprobar con
  `cmux read-screen --workspace workspace:<n>` que arrancó de verdad.
  (`cmux list-workspaces` sigue funcionando, pero ya es alias de
  `cmux workspace list`; el label del workspace se queda pegado al del slice
  anterior, así que no fiarse de él para saber qué slice corre dentro.)
## Residuo pendiente
- `origin/feat/2` sigue viva en GitHub: el borrado quedó fuera del alcance de
  esta sesión. Se limpia con
  `gh api -X DELETE repos/jjponz/repo-pulse/git/refs/heads/feat/2`, o con
  `git push origin --delete feat/2` desde una rama que no sea `main`.
- Rama local `respaldo-feat-2-pre-rebase`: red de seguridad del rebase del #2.
  Su contenido está contenido en `main` salvo cosas que se corrigieron DESPUÉS
  (`git diff origin/main respaldo-feat-2-pre-rebase` solo resta). Es borrable,
  pero se deja porque nadie lo pidió.
## Critical Files
