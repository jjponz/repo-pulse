# Scripts del `package.json` raíz

Fuente: el `package.json` raíz y la sección "Build, test & lint" de `AGENTS.md`. Se lanzan desde la raíz con `npm run <script>` y cada uno cubre los dos workspaces (`server/` y `web/`).

| Script | Comando exacto | Qué ejecuta |
|---|---|---|
| `build` | `npm run build --workspaces` | En `server/`: typecheck de todo `src` con `tsconfig.json` (tests incluidos) y emit a `dist/` con `tsconfig.build.json`. En `web/`: `tsc --noEmit` + `vite build`. |
| `test` | `npm run test --workspaces` | Vitest (`vitest run`) en cada workspace. |
| `lint` | `eslint .` | ESLint 9 (flat config en `eslint.config.js`) sobre todo el repo. |
