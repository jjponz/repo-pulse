# Controles locales de repo-pulse

Estas son las comprobaciones que se pasan en local antes de abrir un pull
request. La CI (`.github/workflows/ci.yml`) ejecuta las mismas en cada pull
request y en cada push a `main`.

Para el detalle de cada workspace, `## Build, test & lint` de `AGENTS.md` es
la guía durable.

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
