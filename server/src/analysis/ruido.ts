/**
 * Ruido generado: ficheros que no dicen nada del trabajo humano. Solo afectan al
 * KPI de ficheros tocados (y, más adelante, al reparto por carpeta): NUNCA al
 * conteo de commits ni de autores.
 */

const FICHEROS_RUIDO = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  'Gemfile.lock',
  'go.sum',
])

const CARPETAS_RUIDO = new Set(['dist', 'build', 'vendor'])

export function esRuido(ruta: string): boolean {
  const segmentos = ruta.split('/')
  if (segmentos.some((segmento) => CARPETAS_RUIDO.has(segmento))) return true
  const nombre = segmentos.at(-1) ?? ''
  if (FICHEROS_RUIDO.has(nombre)) return true
  return nombre.endsWith('.min.js') || nombre.endsWith('.map')
}
