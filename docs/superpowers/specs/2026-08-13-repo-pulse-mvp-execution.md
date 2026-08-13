# Repo Pulse MVP — Execution spec

**Handoff origen:** `docs/superpowers/specs/2026-08-13-repo-pulse-mvp-design.md`
**Fecha de congelación:** —
**Estado:** DRAFT

## Hipótesis del experimento

**Apuesta:** con la foto de Repo Pulse (Pulso + Gente + Calor), un responsable
de producto responde sobre cualquier clon local "¿está vivo?, ¿va a más o a
menos?, ¿dónde se concentra el cambio?" en menos de un minuto, sin abrir
`git log`, y puede contarlo en una reunión.

**Cómo sabremos que falló:** usándolo sobre 3 repos reales de `~/git`, alguna
de las tres preguntas sigue exigiendo terminal, o la foto engaña (el ruido
domina el Calor, la tendencia no se sostiene) y no se vuelve a usar en la
siguiente reunión.

**Anti-scope — qué NO hace este epic:** un repo cada vez; sin comparación
entre repos, sin GitHub API ni repos remotos, sin nombres de autores, sin
`git fetch`/`pull` desde la herramienta, sin progreso en streaming, sin rutas
fuera del raíz configurado, sin seguimiento de renames, sin histórico
persistido (solo caché en memoria + settings JSON), sin e2e.

## Decisiones congeladas

- **D-1 · Fuente de datos** — clones locales bajo un raíz configurable
  (default `~/git`); el servidor lee con `git`, sin red. *(Procedencia:
  hablada — «Repos clonados en local».)*
- **D-2 · Alcance** — un repo cada vez; la comparación queda fuera.
  *(Procedencia: hablada — «Un repo cada vez».)*
- **D-3 · Ventana temporal** — 30d / 90d / 12m / todo, seleccionable, 12
  meses por defecto; toda la foto se recalcula con ella. *(Procedencia:
  hablada — «Seleccionable, 12 meses por defecto».)*
- **D-4 · Métrica de calor** — nº de commits que tocan carpeta/fichero en la
  ventana; navegación por carpetas con drill-down hasta fichero.
  *(Procedencia: hablada — «Nº de commits que lo tocan» y «Carpetas con
  drill-down a fichero».)*
- **D-5 · Gente sin nombres** — serie de autores activos + concentración
  (mínimo nº de autores que suma ≥80%); los nombres no aparecen en API ni UI.
  *(Procedencia: hablada — «Número + reparto, sin nombres».)*
- **D-6 · Carpeta principal** — acota SOLO el Calor y sus %; auto `src/` si
  existe (raíz si no), selector en el bloque Calor, persistida por repo.
  *(Procedencia: hablada — «Solo el Calor se acota» y «Auto src/ + selector,
  persistido».)*
- **D-7 · Sin las 3 ampliaciones de la maqueta** — banner stale sin botón
  "Traer cambios", carga indeterminada sin progreso por pasos, sin "Elegir
  otra carpeta…". *(Procedencia: hablada — «Ninguna: MVP sin ellas».)*
- **D-8 · Stack** — React + Node *(hablada — «La interfaz será en React y el
  servidor en Node, todo dentro de este repo»)*; Vite, Express, TypeScript,
  Vitest, npm workspaces *(hablada — OK al diseño completo, 2026-08-13)*.
- **D-9 · Reglas de cálculo** — HEAD del clon sin merges; autor = email en
  minúsculas con `.mailmap`; cubos día/semana/mes según ventana; exclusiones
  fijas de ruido; renames no se siguen; banner de desactualizado a los 7 días
  de `FETCH_HEAD`. *(Procedencia: hablada — OK al diseño completo.)*
- **D-10 · Arquitectura** — el análisis es un módulo puro y el único código
  que ejecuta `git`; caché en memoria por (repo, ventana, sha de HEAD); API
  de 3 GET + 1 PUT; sin base de datos. *(Procedencia: hablada — OK al diseño
  completo.)*
- **D-11 · Referencia visual** — manda `docs/design/repo-pulse-mockup.html`
  (maqueta aportada por el usuario); los chips "estado de demo" del pie no
  van al producto. *(Procedencia: hablada — maqueta entregada + OK al
  diseño.)*

## Enfoque técnico

El corazón es el módulo de análisis (`server/src/analysis/`): puro,
testeable con repos fixture, sin HTTP. Se construye primero (pulso/gente,
luego calor, que reutiliza el mismo walker de historial), después la API
Express que lo sirve con caché, y por último la UI en tres slices contra la
API real: shell+Pulso, Gente+Calor, estados no felices. El esqueleto del
monorepo con CI va delante de todo y es el único slice que toca CI.

Áreas: `tooling` (#1), `server` (#2–#4), `web` (#5–#7). Los slices de server
y los de web quedan serializados entre sí por área; las dependencias marcan
además el orden real de consumo de interfaces.

## Contexto del epic

- Stack: Node ≥22, TypeScript estricto; npm workspaces: `web/` (Vite+React) y `server/` (Express); tests con Vitest.
- `server/src/analysis/` es un módulo puro y el ÚNICO código que ejecuta `git`.
- Referencia visual obligatoria: `docs/design/repo-pulse-mockup.html`; los chips "estado de demo" del pie NO se implementan.
- Los nombres de autores no salen NUNCA del servidor: ni en payloads de API ni en el DOM — solo conteos y porcentajes.
- Cálculo: HEAD del clon sin merge commits; autor = email en minúsculas respetando `.mailmap`; concentración = mínimo nº de autores que suma ≥80% de los commits.
- Ventanas: `30d`, `90d`, `12m` (default), `all`; cubos: día (30d), semana (90d, 12m), mes (all); tendencia = ventana actual vs anterior de igual longitud; en `all` no hay comparable y se declara.
- Exclusiones de ruido (aplican al Calor y al KPI "ficheros tocados"): `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `poetry.lock`, `Gemfile.lock`, `go.sum`, `*.min.js`, `*.map`, rutas bajo `dist/`, `build/`, `vendor/`.
- Carpeta principal: default `src/` si existe (raíz si no); acota SOLO el Calor y sus %; persistida por repo en un JSON de datos del servidor; si la guardada ya no existe, fallback a la automática con aviso.
- Raíz de clones configurable (default `~/git`); se escanean solo hijos directos; `id` de repo = nombre de su carpeta.
- Renames: no se siguen (un rename es un path nuevo). Caché en memoria por (repo, ventana, sha de HEAD). Sin base de datos.
- Foto desactualizada: mtime de `.git/FETCH_HEAD`; banner si >7 días; sin `FETCH_HEAD`, ni fecha ni banner.
- Textos de UI en español, como la maqueta.
- Tests del análisis y de la API contra repos fixture creados en tmp (`git init` + commits con `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` fijadas); nunca contra repos reales de la máquina.

## Tabla de slices

| # | Slice | Tipo | Entrega | Dep | Acepta | Protegido | Área | Toca | Gate |
|---|-------|------|---------|-----|--------|-----------|------|------|------|
| 1 | esqueleto | infra | monorepo npm workspaces (`web/` Vite+React+TS, `server/` Express+TS) con Vitest+ESLint, CI en GitHub Actions y AGENTS.md actualizado con los comandos reales | – | `npm run build && npm test && npm run lint` terminan con exit 0 en un checkout limpio, la CI ejecuta build+test+lint en cada PR, AGENTS.md documenta esos comandos | La sección "Formato de la tabla de slices" de AGENTS.md no se toca | tooling | ci | – |
| 2 | análisis: pulso y gente | backend | en los workspaces de #1: `server/src/analysis` con walkHistory(repo\, ventana) → cubos de commits\, serie de autores\, tendencia\, KPIs y concentración | #1 | con un fixture de fechas conocidas los cubos suman el total de commits sin merges, dos emails del mismo autor que difieren en mayúsculas cuentan como un autor, en ventana `all` la tendencia es null y se declara no comparable, la concentración es el mínimo nº de autores que suma el 80% o más | Nada de Express ni de UI en este slice | server | – | – |
| 3 | análisis: calor | backend | heatTree() consume el walker de historial de #2 → conteo por carpeta/fichero\, % sobre carpeta principal\, exclusiones de ruido y auto-detección de src/ | #2 | package-lock.json no aparece ni en el árbol ni en el KPI de ficheros tocados, el % de cada hijo se calcula sobre el total de la carpeta principal, con src/ presente la carpeta principal por defecto es src/ y sin ella es la raíz, un fichero renombrado en el fixture aparece como path nuevo | Nada de Express ni de UI en este slice | server | – | – |
| 4 | API HTTP | backend | Express sirviendo los módulos de #2 y #3: GET /api/repos\, GET /summary\, GET /heat\, PUT /settings\, con caché (repo\, ventana\, sha HEAD) y raíz configurable | #2, #3 | GET summary de un fixture devuelve pulso\, gente\, tendencia y meta en un solo payload, GET heat con path devuelve solo los hijos de ese nivel, una segunda petición con el mismo HEAD no vuelve a ejecutar git, PUT settings persiste mainFolder y sobrevive a un reinicio del servidor, una carpeta sin .git devuelve un error tipado distinguible del repo sin commits | Sin endpoints que muten los clones (nada de fetch/pull) | server | – | – |
| 5 | UI: shell y pulso | ui | shell React contra GET /api/repos y /summary de #4: cabecera (selector de repo + ventana)\, bloque Pulso con overlay del periodo anterior\, panel Tendencia + KPIs\, según la maqueta | #4 | cambiar la ventana recalcula pulso\, tendencia y KPIs sin recargar la página, con ventana `all` el panel de tendencia declara que no hay comparable, la cabecera enseña último commit y fecha de traída cuando existe | Los chips "estado de demo" de la maqueta no se implementan | web | – | – |
| 6 | UI: gente y calor | ui | monta en el shell de #5 los bloques Gente (serie + concentración) y Calor (breadcrumb + drill-down) contra GET /heat y PUT /settings de #4\, con selector de carpeta principal persistido | #5 | el drill-down baja hasta fichero y el breadcrumb vuelve a cualquier nivel, cambiar la carpeta principal reacota los % del Calor y se recuerda al reabrir el repo, ningún nombre de autor aparece en el DOM | – | web | – | – |
| 7 | UI: estados no felices | ui | sobre las vistas de #5 y #6: carga indeterminada\, ventana sin actividad con CTA\, no-repo\, sin commits\, banner de foto desactualizada | #6 | una ventana con 0 commits enseña "0 commits en X" con CTA a 12 meses, una carpeta sin .git enseña el estado diseñado con la lista de clones, un clon con FETCH_HEAD de más de 7 días enseña el banner de desactualizado, un clon sin FETCH_HEAD no enseña ni fecha de traída ni banner | Sin botón "Traer cambios", sin progreso por pasos, sin "Elegir otra carpeta…" | web | – | – |

## Decisiones aparcadas (BLOCKED)

| ID | Fila | Qué falta decidir | Opciones vistas | Estado |
|----|------|-------------------|-----------------|--------|

*(Vacía al congelar. Futuro ya descartado del MVP, por si se retoma: botón
"Traer cambios", progreso en streaming, explorador de carpetas, comparación
multi-repo, seguimiento de renames, toggle de exclusiones.)*

## Registro de cierre (evidencia)

| Slice | specReviewedSha | codeReviewedSha | uiScreenshot | Gate cerrado con |
|-------|-----------------|-----------------|--------------|------------------|
