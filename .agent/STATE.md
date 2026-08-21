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
you_are_here: "CINCO slices cerrados y cosechados (PR #8 → 9824d3d, PR #10 → 46a52c0, PR #13 → 6d933db, PR #15 → c178caa, PR #17 → 0514c35), más el refactor a inglés (PR #12 → 66c34ac). El #5 (UI: shell y pulso) cerró el 2026-08-19 y está cosechado: labels ya limpias (se le retiró status:in-review el 2026-08-21). Del #5 no queda residuo: worktree, rama local, rama remota, labels y sesión de cmux limpiados el 2026-08-21. Su rama local NO era la que se mergeó (línea huérfana del run de prueba de ct-step) y se descartó a conciencia: ver el gotcha. Cap 0/1 LIBRE, nada en vuelo. El #6 (UI: gente y calor) está en status:ready desde el 2026-08-21; el #7 sigue en status:backlog."
next_action: "Despachar el #6 (UI: gente y calor) con /ct-next, y atender su gate plan cuando lo publique como comentario del issue"
# blocked: null = NO bloqueado. Si el trabajo no puede continuar (una decisión
# lo paró, el plan resultó falso, falta algo de fuera), NO lo escribas en prosa
# dentro de next_action: ponlo aquí. El hook de SessionStart lo anuncia al
# arrancar cualquier sesión de este repo y SUSPENDE el next_action.
#   blocked: {reason: "por qué no se puede continuar", unblock: "qué haría falta para levantarlo", since: "2026-07-25"}
# Levantarlo es borrar el campo (o volver a null): una decisión deliberada.
blocked: null
# verify: la comprobación PENDIENTE que valida este trabajo AL TERMINAR — nunca
# un hecho ya comprobado, aunque se redacte en presente.
verify: "/ct-status sale en verde (exit 0) sin residuo del #5, y /ct-next deja el #6 en status:in-progress con su worktree y su sesión de cmux vivos"
tasks: []
---
## Current State
Epic groomeado (milestone + issues #1–#7 + labels + Project v2). Todo el BACKEND
está entregado y cosechado: #1 (esqueleto), #2 (pulso y gente), #3 (calor) y #4
(API HTTP). `server/` sirve hoy los cuatro endpoints bajo `/api` sobre el módulo
puro `server/src/analysis/`, con caché por (repo, ventana, HEAD, día) y el sobre
de error tipado `{error:{code,message}}`. El FRONT arrancó: el #5 (UI: shell y
pulso) cerró el 2026-08-19 en squash (PR #17 → 0514c35) y `web/` ya no es el stub
del #1 — trae el proxy de dev a la API, el entorno DOM de test, los tokens del
design system, la capa de textos en español, el cliente tipado, la cabecera, el
bloque Pulso con overlay del periodo anterior y el panel de Tendencia y KPIs.
Cap 0/1 LIBRE: nada en vuelo y sin residuo. El #6 (UI: gente y calor) está en
`status:ready` y es el siguiente en el orden del §9; el #7 en `status:backlog`.
## Immediate Next Steps
1. Despachar el #6 con `/ct-next` (cap libre, dependencias mergeadas).
2. Atender su gate plan: revisar el plan que publique como comentario del issue,
   responder OK y EMPUJARLO a mano por cmux (responder en GitHub no lo despierta).
3. En el PR, exigir el gate visual: captura antes/después y la ruta para
   reproducirlo. No lo cierra el agente.
## Decisions Made
- Slice #5 cerrado el 2026-08-19 (PR #17 en squash, 0514c35), sin rechazos ni
  reopens ni requeues. Cosechado: ready→claim 0m31, claim→release 51h03m39,
  release→merge 1h18m14, PR +2397/−16 en 20 ficheros. Es el primer slice de la
  familia `ui`, así que su claim→release es hoy la única cifra de esa familia con
  merge (N=3 con el #6 y el #7 todavía sin arrancar): no promediar nada con ella.
  Como en el #4, la cifra alta no es tiempo de trabajo — el slice esperó su gate.
- Slice #4 cerrado el 2026-08-17 (PR #15 en squash, c178caa), sin rechazos ni
  reopens. Cosechado: ready→claim 1m38, claim→release 66h23m20 (la cifra más alta
  del epic, y no es tiempo de trabajo: el slice se despachó el 14 y cruzó el fin
  de semana esperando su gate), release→merge 21m51, PR +1698/−10 en 19 ficheros.
- El "Contexto heredado" del #5 lo escribió la coordinadora el 2026-08-17 ANTES de
  despacharlo, y es la primera vez que esa sección se usa: hasta el #4 todos los
  slices heredaban de un módulo puro que no tenía contrato de red. Trae el
  contrato REAL de la API tal como quedó mergeada (rutas, forma de los payloads,
  `previousWindowBuckets` como overlay alineado por índice, `trend.comparable`
  para el AC de `all`, la lista de `code` de error) y NOMBRA las dos decisiones que
  el issue no cierra: cómo llega la UI a la API en dev y qué entorno DOM de test
  monta `web/`. Si el plan del #5 las contradice, la fuente es esa sección.
- Slice #3 cerrado el 2026-08-14 (PR #13 en squash, 6d933db) tras RECHAZARLO una
  vez en revisión y devolverlo con `--reopen`. El bug: `unquotePath` (que el
  agente añadió por su cuenta, el issue no lo pedía) mezclaba code units UTF-16
  con bytes, así que un path con no-ASCII Y un carácter C-quoteado a la vez
  salía corrupto y dejaba de casar con `readDirectories`. Sus tests cubrían los
  dos casos POR SEPARADO y nunca el cruce. Se arregló con `codePointAt` + bytes
  UTF-8 y un test del cruce (`á` y un emoji). Sin gate apply, como el #2.
- TODO EL CÓDIGO SE ESCRIBE EN INGLÉS (decisión del 2026-08-14). Identificadores,
  ficheros, comentarios, nombres de test y mensajes de error; regla boy scout
  para lo que quede en español. Lo que NO es código sigue en español: texto
  visible de la UI y vocabulario de producto (Pulso, Gente, Calor), la maqueta,
  issues, specs, cuerpos de PR y este fichero. La regla vive en AGENTS.md
  ("Code style & conventions"), que hasta hoy ordenaba lo contrario. Con ella se
  renombró entero `server/src/analysis/` (ver el gotcha del mapa de nombres): se
  hizo AHORA porque el módulo no tenía todavía ningún consumidor, y el #3 y el
  #4 lo iban a fijar.
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
- MAPA DE NOMBRES del renombrado a inglés de `server/src/analysis/` — lo que un
  slice posterior busque por el nombre viejo NO lo va a encontrar:
  ficheros `tipos→types`, `ruido→noise`, `ventanas→windows`, `agregado→aggregate`
  (`git.ts` e `index.ts` no cambian de nombre);
  API `Ventana→TimeWindow` (no `Window`: choca con el global del DOM),
  `TamanoCubo→BucketSize`, `Cubo→Bucket`, `Analisis→Analysis`,
  `Tendencia→Trend`, `Concentracion→Concentration`,
  `MotivoNoComparable→NotComparableReason`, `ErrorAnalisis→AnalysisError`,
  `CodigoErrorAnalisis→AnalysisErrorCode`, `VENTANAS→WINDOWS`,
  `VENTANA_POR_DEFECTO→DEFAULT_WINDOW`, `esVentana→isTimeWindow`,
  `leerHeadSha→readHeadSha`, `esRuido→isNoise`, `agregar→aggregate`,
  `rejilla()→buildGrid()` (la función se separa del tipo `Grid`),
  `indiceCubo→bucketIndex`, `cubosVentanaAnterior→previousWindowBuckets`;
  fixture `crearRepoFixture→createRepoFixture`,
  `commitsSinMerges→nonMergeCommits`, `.ruta→.path`, `.limpiar()→.cleanup()`.
  `walkHistory` no cambia. También cambiaron VALORES del payload:
  `'dia'|'semana'|'mes'→'day'|'week'|'month'`,
  `'ventana-completa'→'full-window'`, `'sin-commits-previos'→'no-previous-commits'`,
  `'no-es-repo-git'→'not-a-git-repo'`, `'git-ha-fallado'→'git-failed'`.
- `git.ts` y `git.test.ts` llevan `'\u0000'` y `'\u001f'` (separadores de
  `git log`) ESCRITOS COMO ESCAPES a propósito. Un editor —o un agente— que los
  sustituya por los caracteres de control literales no rompe los tests (el valor
  es el mismo), pero deja bytes NUL invisibles en el fuente y git puede tratar el
  fichero como binario. Si un diff sale raro ahí, es esto.
- `/ct-next` en este repo necesita `CT_ACCOUNT_PERSONAL_DIR=$HOME/.claude` y
  `CT_AGENT_BIN_PERSONAL=claude`: no existen ni `~/.claude-personal` ni el
  binario `claude-personal`.
- Los labels `gate:plan`/`gate:apply` del issue marcan qué gates aplican, no si
  están cerrados: siguen puestos aunque el gate ya se haya pasado. Lo mismo con
  el `status:in-review` de un issue ya cerrado: no es anomalía mientras no se
  haya cosechado, y `/ct-next` lo dice en cada corrida. Pero la cosecha SÍ lo
  retira: el #2, el #3 y el #4 quedaron solo con sus `gate:*` + `type:*` +
  `area:*`, y el #5 se alineó con ellos el 2026-08-21. Un `status:*` en un issue
  cerrado es la señal de que ese slice aún no se ha cosechado.
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
      cmux send-key --workspace workspace:<n> enter
  Los DOS comandos: `send` solo escribe en el prompt, deja el texto sin enviar
  (el `\n` que documenta su ayuda no lo envió aquí).
  LA TECLA VA EN MINÚSCULA: `send-key ... enter`, como el ejemplo de su propia
  ayuda (`cmux send-key enter`). Con `Enter` capitalizado el comando devuelve
  `OK surface:<n> workspace:<n>` y exit 0 y el texto SE QUEDA en el prompt sin
  enviarse. Medido el 2026-08-19 empujando el #5: `Enter` envió 1 de 4 veces,
  `enter` 1 de 1 y al primer intento. El exit 0 dice que la tecla se entregó a la
  superficie, no que el prompt se enviara, así que no sirve de confirmación.
  COMPROBAR SIEMPRE con `cmux read-screen --workspace workspace:<n>`: si el texto
  sigue dentro del recuadro del prompt, NO se ha enviado; enviado de verdad es
  verlo subir al historial y al agente trabajando («Sketching…», «Sprouting…»).
  Y no repetir Enter a ciegas: cada pulsación que sí entre en un prompt vacío es
  un turno vacío que el agente tiene que contestar.
  (`cmux list-workspaces` sigue funcionando, pero ya es alias de
  `cmux workspace list`; se cierra con `cmux workspace close workspace:<n>`.)
- EL LABEL DEL WORKSPACE DE CMUX MIENTE, Y CASI CUESTA MATAR ESTA SESIÓN.
  `workspace:2` se llama «repo-pulse · #1 esqueleto» pero es la sesión
  COORDINADORA (esta), no la de ningún slice: el nombre se queda pegado al del
  slice con el que se creó el workspace. Un `cmux workspace close workspace:2`
  habría matado la sesión desde la que se coordina el loop. Antes de cerrar un
  workspace, comprobar de quién es POR CONTENIDO, no por el nombre:
      cmux read-screen --workspace workspace:<n>   # ¿es tu propia conversación?
      pgrep -f claude + lsof -p <pid> -d cwd       # el del slice vive en .worktrees/<n>
  La sesión de un slice arranca además con `--dangerously-skip-permissions`
  («bypass permissions on» en su pie), la coordinadora no.
  Y LOS IDENTIFICADORES NO PERSISTEN: el reparto que este gotcha traía escrito
  (`workspace:2` = coordinadora, `workspace:6` = slice #5) ya no existe — el
  2026-08-21 `cmux workspace list` devuelve UN solo workspace, el `workspace:1`
  de la coordinadora de turno. Anotar aquí un reparto concreto caduca; lo que no
  caduca es comprobar de quién es cada workspace por contenido antes de cerrarlo.
- LA RAMA LOCAL DE UN SLICE PUEDE NO SER LA QUE SE MERGEÓ. En el #5, `feat/5`
  local (536c54d, del 2026-08-18) y `origin/feat/5` (9249aff, del 2026-08-19)
  son DOS LÍNEAS PARALELAS sin ancestro común por encima de 1c64f95: la local es
  el run de prueba de `ct-step` (su primer commit lo dice: «fixture ejecutable,
  para la prueba de ct-step») y la remota es la que entró por el PR #17. Las dos
  implementan las mismas 8 tareas con hashes distintos y contenido distinto
  (`git diff origin/main HEAD` en el worktree: 16 ficheros, +488/−533; ningún
  fichero exclusivo por ninguno de los dos lados). Consecuencia para el gotcha de
  abajo: `git diff main feat/<n>` NO sale vacío aunque el slice esté íntegramente
  mergeado, porque compara contra la línea equivocada. La comprobación buena es
  `git diff origin/main origin/feat/<n>` — en el #5 sale solo `.agent/STATE.md`.
  La local se borró con `-D` el 2026-08-21 (con `-d` no habría salido: al no ser
  ancestro de nada publicado, git la trata como no mergeada, que ahí es la
  verdad). Si el próximo slice vuelve a dejar dos líneas, esta es la lectura.
- BORRAR LA RAMA DE UN SLICE YA MERGEADO PIDE `-d` CON AVISO, no `-D`. Los PRs se
  mergean en SQUASH, así que `feat/<n>` nunca es ancestro de `main` y `git branch
  -d` avisa («merged to refs/remotes/origin/feat/<n>, but not yet merged to
  HEAD») antes de borrar. No es señal de que quede trabajo: eso se comprueba con
  `git diff main feat/<n>` (dos puntos, no tres — con tres sale el diff entero del
  slice aunque esté todo mergeado). Vacío = no hay nada que rescatar.
## Residuo pendiente
- Ninguno EN RAMAS `feat/*` ni en disco. Pero el 2026-08-21 aparecieron dos ramas
  remotas `chore/*` que ninguna cosecha miraba, porque este apartado solo vigilaba
  las de slice: `chore/state-slice-5` (PR #16, mergeada en SQUASH, con DOS commits
  posteriores al merge que nunca entraron — de ahí se recuperó el gotcha de la
  tecla de cmux) y `chore/state-slice-5-cosechado` (PR #18, mergeada, rama no
  borrada). Las dos se borraron ese mismo día. LECCIÓN: un squash merge deja la
  rama viva, y lo que se commitee en ella DESPUÉS del merge no está en ningún
  sitio aunque la PR salga en verde. Al cosechar, mirar `git ls-remote --heads
  origin` entero, no solo `feat/*`.
- El #5 se cosechó el 2026-08-21: labels alineadas con el #2/#3/#4,
  `.worktrees/5` retirado, rama local `feat/5` borrada con `-D` (era la línea
  huérfana del run de prueba, 536c54d, descartada a conciencia por decisión
  explícita: no aportaba ningún fichero que no estuviera ya en `main`), rama
  remota `feat/5` borrada por `gh api -X DELETE`, y sin workspace de cmux que
  cerrar. `.worktrees/` queda vacío y no hay ninguna rama `feat/*` ni en local ni
  en remoto.
## Critical Files
