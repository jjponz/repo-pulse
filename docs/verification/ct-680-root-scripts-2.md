# Scripts del `package.json` raíz

Se ejecutan desde la raíz del repositorio con `npm run <script>`.

| Script | Comando exacto | Qué ejecuta |
|---|---|---|
| `build` | `npm run build --workspaces` | El `build` de cada workspace. En `server/`: `tsc --noEmit -p tsconfig.json && tsc -p tsconfig.build.json` (comprobación de tipos de todo `src` y emisión a `dist/`). En `web/`: `tsc --noEmit -p tsconfig.json && vite build`. |
| `test` | `npm run test --workspaces` | El `test` de cada workspace: `vitest run` en `server/` y en `web/`. |
| `lint` | `eslint .` | ESLint 9 con la configuración plana de `eslint.config.js` sobre todo el repositorio. |
