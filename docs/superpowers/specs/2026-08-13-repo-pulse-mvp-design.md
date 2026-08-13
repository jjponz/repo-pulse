# Repo Pulse MVP — Design doc

**Fecha:** 2026-08-13
**Estado:** aprobado en brainstorming (sección a sección + maqueta visual). Tras la
congelación del execution spec, este documento es historia: no se edita.

## 1. Contexto y objetivo

Un responsable de producto quiere mirar cualquier repositorio de código y
entender rápido dos cosas: **con qué ritmo se actualiza** (¿está vivo? ¿cuánta
gente lo toca? ¿va a más o a menos?) y **dónde se concentra el cambio** (las
carpetas y ficheros "calientes"). Hoy eso se hace a ojo con `git log` y no se
puede contar en una reunión.

Repo Pulse es una aplicación web local: UI en React, servidor en Node, todo en
este repo. Analiza **clones locales** de la máquina del usuario (bajo un
directorio raíz configurable, por defecto `~/git`), **un repo cada vez**. Sin
GitHub API, sin auth, sin red.

## 2. La pantalla (el QUÉ)

Una sola pantalla por repo. Cabecera: selector de repo (los clones detectados),
ruta, "último commit hace X días", y selector de ventana temporal —
**30 días / 90 días / 12 meses (por defecto) / todo el historial**. Todo lo de
abajo se recalcula con la ventana elegida.

- **Pulso** — *¿está vivo? ¿va a más o a menos?* Serie de commits por cubo
  (día en 30d, semana en 90d/12m, mes en "todo"), con la **ventana anterior de
  igual longitud superpuesta en gris**. Panel de tendencia: "% vs periodo
  anterior" con la comparación en claro ("312 commits antes · 384 ahora"), y
  KPIs de la ventana: commits, autores activos, ficheros tocados. En "todo el
  historial" no hay comparable y se declara.
- **Gente** — *¿cuánta gente lo toca? ¿depende de pocos?* Serie de autores
  activos por cubo + concentración **sin nombres**: "2 personas concentran el
  80% de los commits" (mínimo nº de autores que suma ≥80%). Los nombres de
  autores no aparecen en ninguna parte de la herramienta (ni API ni UI).
- **Calor** — *¿dónde se concentra el cambio?* Navegación por carpetas con
  breadcrumb y "← subir": cada nivel lista sus hijos ordenados por nº de
  commits que los tocan en la ventana, con % **sobre la carpeta principal**, y
  baja hasta el fichero.

### Carpeta principal

El Calor se acota a una **carpeta principal** por repo: por defecto `src/` si
existe (la raíz si no), cambiable con un selector en el bloque Calor y
**persistida por repo** en el servidor. Solo acota el Calor y sus porcentajes;
**Pulso y Gente miden siempre el repo entero** (el ritmo y la gente son del
repo; el calor es del código). Si la carpeta guardada deja de existir,
fallback a la automática con aviso.

### Estados no felices (todos diseñados en la maqueta)

- **Carga de repo grande**: indicador indeterminado (sin cifras de progreso).
- **Ventana sin actividad**: "0 commits en 90 días" es una respuesta, no un
  error; CTA "Ver 12 meses".
- **Carpeta que no es repo git**: explicación + lista de clones detectados.
- **Repo sin commits**: repo válido, historial vacío, se dice tal cual.
- **Foto desactualizada**: se enseña siempre "traída hace X" (mtime de
  `FETCH_HEAD`); banner de aviso si supera 7 días. Si el clon no tiene
  `FETCH_HEAD` (nunca ha hecho fetch), no hay fecha de traída y no se avisa.
  Sin botón de fetch: el `git pull` lo hace el usuario.

## 3. Arquitectura

Monorepo npm workspaces:

```
web/      # React + Vite + TypeScript (SPA)
server/   # Node + Express + TypeScript
server/src/analysis/   # módulo PURO: (rutaRepo, ventana, carpetaPrincipal) → métricas
docs/design/repo-pulse-mockup.html   # referencia visual obligatoria
```

- El módulo de análisis es el **único** sitio que ejecuta `git`; el servidor
  web lo llama y cachea. Reutilizable tal cual para comparación/histórico
  futuros.
- **Caché en memoria** con clave `(repo, ventana, sha de HEAD)`: se invalida
  sola cuando el clon avanza; la segunda carga de un repo grande es
  instantánea. Sin base de datos.
- Configuración: raíz de clones por env/config (default `~/git`); se escanean
  solo los **hijos directos** del raíz (sin recursión), y el `id` de cada repo
  es su nombre de carpeta. Settings por repo (carpeta principal) en un JSON de
  datos del servidor.

## 4. Contratos API

- `GET /api/repos` → clones detectados: `{id, name, path, lastCommitAt, fetchedAt}`.
- `GET /api/repos/:id/summary?window=12m` → Pulso + Gente + tendencia + KPIs +
  meta (último commit, fecha de traída, stale).
- `GET /api/repos/:id/heat?window=12m&path=src/checkout` → hijos de ese nivel:
  `{nombre, tipo dir|fichero, commits, % sobre la carpeta principal}`. El
  drill-down pide nivel a nivel: el payload no explota en repos grandes.
- `PUT /api/repos/:id/settings` `{mainFolder}` → persiste la carpeta principal.
- Errores tipados: repo desconocido (404), carpeta sin `.git`, repo sin
  commits — cada uno distinguible por la UI para pintar su estado.

## 5. Reglas de cálculo

- Se cuenta la rama en la que está el clon (**HEAD**), **sin merge commits**.
- Autor = email normalizado a minúsculas, respetando `.mailmap` si existe.
- Concentración = mínimo nº de autores cuyos commits suman ≥80% del total.
- Cubos: día (30d), semana (90d, 12m), mes (todo). Tendencia = ventana actual
  vs la anterior de igual longitud; en "todo" no existe y se declara.
- **Ruido excluido** (lista fija documentada): lockfiles (`package-lock.json`,
  `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `poetry.lock`, `Gemfile.lock`,
  `go.sum`), `*.min.js`, `*.map`, y rutas bajo `dist/`, `build/`, `vendor/`.
  Aplica al Calor y al KPI "ficheros tocados"; commits y autores no se filtran.
- **Renames no se siguen** en el MVP: fichero renombrado = path nuevo.
  Limitación documentada.

## 6. Testing

- **Análisis** (el corazón): tests unitarios contra repos fixture generados en
  tmp (`git init` + commits scriptados con `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`
  fijadas) — deterministas.
- **API**: integración (supertest) sobre esos mismos fixtures.
- **UI**: Vitest + Testing Library para los estados (ok / vacío / carga /
  error). Sin e2e en el MVP.
- El primer slice deja CI (GitHub Actions) corriendo build + test + lint, y
  actualiza `AGENTS.md` con los comandos reales.

## 7. Referencia visual

`docs/design/repo-pulse-mockup.html` — maqueta interactiva aportada por el
usuario (Claude design), aprobada. Define tipografía, layout de dos columnas,
los cuatro estados no felices, el overlay del periodo anterior en el Pulso, la
barra de concentración y las filas de calor. Los "chips de estado de demo" del
pie son artefacto de demo: **no** van al producto. Las tres ampliaciones que la
maqueta insinúa quedan **fuera del MVP**: botón "Traer cambios" (git fetch),
progreso real por pasos en la carga, y "Elegir otra carpeta…" fuera del raíz.
La nota al pie del Calor de la maqueta ("el % es sobre el total del repo") es
anterior a la decisión de carpeta principal: en el producto, el % es sobre la
carpeta principal.

## 8. Fuera de alcance (MVP)

Comparación entre repos · GitHub API o repos remotos · nombres de autores ·
`git fetch`/`pull` desde la herramienta · progreso de análisis en streaming ·
rutas fuera del raíz configurado · seguimiento de renames · persistencia de
histórico (solo caché en memoria + settings JSON) · e2e.
