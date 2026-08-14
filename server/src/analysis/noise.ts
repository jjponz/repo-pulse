/**
 * Generated noise: files that say nothing about human work. They only affect the
 * touched-files KPI (and, later on, the per-directory split): NEVER the commit
 * or author counts.
 */

const NOISE_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  'Gemfile.lock',
  'go.sum',
])

const NOISE_DIRECTORIES = new Set(['dist', 'build', 'vendor'])

export function isNoise(path: string): boolean {
  const segments = path.split('/')
  if (segments.some((segment) => NOISE_DIRECTORIES.has(segment))) return true
  const name = segments.at(-1) ?? ''
  if (NOISE_FILES.has(name)) return true
  return name.endsWith('.min.js') || name.endsWith('.map')
}
