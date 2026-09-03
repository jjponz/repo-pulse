import type { BucketSize, Concentration, TimeWindow, Trend } from './api/types'

/**
 * The single place the API's English payload values become the Spanish text
 * the user reads. Pure: no DOM, no fetch, no clock reads — `relativeDays`
 * takes `now` as a parameter so callers (and tests) control it. The header,
 * the pulse chart and the trend/KPI panel call these functions instead of
 * formatting anything themselves.
 */

export function windowLabel(window: TimeWindow): string {
  switch (window) {
    case '30d':
      return '30 días'
    case '90d':
      return '90 días'
    case '12m':
      return '12 meses'
    case 'all':
      return 'todo'
  }
}

export function previousWindowLabel(window: TimeWindow): string {
  switch (window) {
    case '30d':
      return 'los 30 días anteriores'
    case '90d':
      return 'los 90 días anteriores'
    case '12m':
      return 'los 12 meses anteriores'
    case 'all':
      return '—'
  }
}

export function bucketNoun(bucket: BucketSize): string {
  switch (bucket) {
    case 'day':
      return 'día'
    case 'week':
      return 'semana'
    case 'month':
      return 'mes'
  }
}

/** `13 ago 2026`, in UTC like the ISO dates the server sends. */
const dayFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** `ago 2026`, same rule minus the day. */
const monthFormatter = new Intl.DateTimeFormat('es-ES', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatDay(iso: string): string {
  return dayFormatter.format(new Date(iso))
}

export function formatMonth(iso: string): string {
  return monthFormatter.format(new Date(iso))
}

/** `null` means the window has no commits at all: shown as a dash. */
export function formatEdge(iso: string | null, window: TimeWindow): string {
  if (iso === null) return '—'
  return window === '30d' || window === '90d' ? formatDay(iso) : formatMonth(iso)
}

const MS_PER_DAY = 86_400_000

export function relativeDays(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / MS_PER_DAY)
  if (days < 1) return 'hoy'
  if (days === 1) return 'hace 1 día'
  return `hace ${days} días`
}

export function trendHeadline(trend: Trend): string {
  if (!trend.comparable || trend.percentage === null) return '—'
  return trend.percentage > 0 ? `+${trend.percentage}%` : `${trend.percentage}%`
}

export function trendArrow(trend: Trend): string {
  if (!trend.comparable || trend.percentage === null) return ''
  return trend.percentage >= 0 ? '↗' : '↘'
}

export function trendSentence(trend: Trend, commits: number): string {
  if (!trend.comparable) {
    return trend.reason === 'full-window'
      ? 'ventana completa: no hay comparable'
      : `0 commits antes · ${commits} ahora — nada que comparar`
  }
  return `${trend.previousWindowCommits} commits antes · ${commits} ahora`
}

export function concentrationSentence(concentration: Concentration, commits: number): string {
  if (commits === 0) return 'Nadie ha tocado el repo en esta ventana.'
  const { authors, percentage } = concentration
  return authors === 1
    ? `1 persona concentra ${percentage}% de los commits`
    : `${authors} personas concentran ${percentage}% de los commits`
}

export function windowLabelLong(window: TimeWindow): string {
  switch (window) {
    case '30d':
      return '30 días'
    case '90d':
      return '90 días'
    case '12m':
      return '12 meses'
    case 'all':
      return 'todo el historial'
  }
}

export function noHeatHeadline(window: TimeWindow): string {
  return `Ninguna carpeta tocada en ${windowLabelLong(window)}`
}

export function mainFolderLabel(mainFolder: string): string {
  return mainFolder === '' ? 'todo el repo' : mainFolder
}

export function heatFooter(children: number, hereCommits: number, mainFolderCommits: number): string {
  if (children === 0) return 'El árbol sigue ahí; en esta ventana nadie lo ha tocado.'
  const touched = children === 1 ? '1 hijo tocado' : `${children} hijos tocados`
  return `${touched} · ${hereCommits} commits aquí · total de la carpeta principal ${mainFolderCommits}`
}

export function fallbackNotice(mainFolder: string): string {
  return `La carpeta principal guardada ya no existe en HEAD: el calor se acota a ${mainFolderLabel(mainFolder)}.`
}

const EMPTY_WINDOW_SENTENCE = 'Es una respuesta, no un fallo: el repo está quieto en esta ventana.'

export function emptyWindowSentence(lastCommitAt: string | null, now: Date): string {
  if (lastCommitAt === null) return EMPTY_WINDOW_SENTENCE
  return `${EMPTY_WINDOW_SENTENCE} Su último commit fue ${relativeDays(lastCommitAt, now)}.`
}

export function analysingHeadline(repoName: string): string {
  return `Analizando ${repoName}…`
}

export function emptyWindowHeadline(window: TimeWindow): string {
  return `0 commits en ${windowLabelLong(window)}`
}

export function emptyWindowCtaLabel(window: TimeWindow): string {
  return `Ver ${windowLabelLong(window)}`
}

export const NOT_A_GIT_REPO_HEADLINE = 'Esa carpeta no es un repositorio git'

export const DETECTED_CLONES_LABEL = 'clones detectados'

export function notAGitRepoSentence(repoId: string): string {
  return `En la carpeta ${repoId} no hay ningún directorio .git, así que no hay historial que medir.`
}

export const NO_COMMITS_HEADLINE = 'Repositorio sin commits'

export const NO_COMMITS_FOOTNOTE = 'Cuando entre el primer commit, esta pantalla se llena sola.'

export const NO_HISTORY_META = 'sin historial · ningún commit todavía'

export function noCommitsSentence(repoName: string): string {
  return `${repoName} es un repo git válido, pero su historial está vacío. No hay pulso que contar todavía.`
}

export function freshSnapshotLine(fetchedAt: string, now: Date): string {
  return `Foto local al día · traída ${relativeDays(fetchedAt, now)}`
}

export function staleSnapshotLine(fetchedAt: string, now: Date): string {
  return `Foto local traída ${relativeDays(fetchedAt, now)}`
}

export function staleBannerSentence(fetchedAt: string, now: Date): string {
  return `Foto local desactualizada: el clon se trajo ${relativeDays(fetchedAt, now)}. Lo que ves puede ir por detrás del remoto.`
}
