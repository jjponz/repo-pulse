import { expect, test } from 'vitest'
import {
  analysingHeadline,
  bucketNoun,
  concentrationSentence,
  emptyWindowCtaLabel,
  emptyWindowHeadline,
  emptyWindowSentence,
  fallbackNotice,
  formatDay,
  formatEdge,
  formatMonth,
  freshSnapshotLine,
  heatFooter,
  mainFolderLabel,
  noCommitsSentence,
  noHeatHeadline,
  notAGitRepoSentence,
  previousWindowLabel,
  relativeDays,
  staleBannerSentence,
  staleSnapshotLine,
  trendArrow,
  trendHeadline,
  trendSentence,
  windowLabel,
  windowLabelLong,
} from './format'
import { DEFAULT_WINDOW } from './api/types'
import type { Concentration, Trend } from './api/types'

test('the full window declares there is nothing to compare', () => {
  const base: Trend = { comparable: false, percentage: null, previousWindowCommits: null, reason: null }

  expect(trendSentence({ ...base, reason: 'full-window' }, 0)).toBe('ventana completa: no hay comparable')
  // The two reasons are the only ones there are, and they do not say the same thing.
  expect(trendSentence({ ...base, reason: 'no-previous-commits' }, 0)).toBe(
    '0 commits antes · 0 ahora — nada que comparar',
  )
})

test('a comparable trend reads previous versus current commits', () => {
  const trend: Trend = { comparable: true, percentage: 100, previousWindowCommits: 2, reason: null }

  expect(trendSentence(trend, 4)).toBe('2 commits antes · 4 ahora')
})

test('the trend headline only signs the positive', () => {
  const notComparable: Trend = { comparable: false, percentage: null, previousWindowCommits: null, reason: 'full-window' }

  expect(trendHeadline(notComparable)).toBe('—')
  expect(trendHeadline({ comparable: true, percentage: 18, previousWindowCommits: 2, reason: null })).toBe('+18%')
  expect(trendHeadline({ comparable: true, percentage: 0, previousWindowCommits: 2, reason: null })).toBe('0%')
  expect(trendHeadline({ comparable: true, percentage: -7, previousWindowCommits: 2, reason: null })).toBe('-7%')
})

test('window edges are formatted by window, in UTC', () => {
  // 23:30 Z is still the 13th in UTC: a formatter without an explicit UTC
  // zone would render the 14th in most local zones.
  const iso = '2026-08-13T23:30:00Z'

  expect(formatEdge(iso, '30d')).toBe('13 ago 2026')
  expect(formatEdge(iso, '90d')).toBe('13 ago 2026')
  expect(formatEdge(iso, '12m')).toBe('ago 2026')
  expect(formatEdge(iso, 'all')).toBe('ago 2026')
  expect(formatEdge(null, '30d')).toBe('—')
})

test('a day ago reads hace 1 día', () => {
  const now = new Date('2026-08-19T12:00:00Z')

  expect(relativeDays('2026-08-18T12:00:00Z', now)).toBe('hace 1 día')
})

test('below a day reads hoy', () => {
  const now = new Date('2026-08-19T12:00:00Z')

  expect(relativeDays('2026-08-19T01:00:00Z', now)).toBe('hoy')
})

test('several days ago pluralizes días', () => {
  const now = new Date('2026-08-19T12:00:00Z')

  expect(relativeDays('2026-08-14T12:00:00Z', now)).toBe('hace 5 días')
})

test('the trend arrow follows the sign, and is silent when not comparable', () => {
  expect(trendArrow({ comparable: false, percentage: null, previousWindowCommits: null, reason: 'full-window' })).toBe('')
  expect(trendArrow({ comparable: true, percentage: 18, previousWindowCommits: 2, reason: null })).toBe('↗')
  expect(trendArrow({ comparable: true, percentage: 0, previousWindowCommits: 2, reason: null })).toBe('↗')
  expect(trendArrow({ comparable: true, percentage: -7, previousWindowCommits: 2, reason: null })).toBe('↘')
})

test('the window label matches the mockup wording', () => {
  expect(windowLabel('30d')).toBe('30 días')
  expect(windowLabel('90d')).toBe('90 días')
  expect(windowLabel('12m')).toBe('12 meses')
  expect(windowLabel('all')).toBe('todo')
})

test('the previous window label has no equivalent for all', () => {
  expect(previousWindowLabel('30d')).toBe('los 30 días anteriores')
  expect(previousWindowLabel('90d')).toBe('los 90 días anteriores')
  expect(previousWindowLabel('12m')).toBe('los 12 meses anteriores')
  expect(previousWindowLabel('all')).toBe('—')
})

test('the bucket noun names the bucket size', () => {
  expect(bucketNoun('day')).toBe('día')
  expect(bucketNoun('week')).toBe('semana')
  expect(bucketNoun('month')).toBe('mes')
})

test('formatDay and formatMonth render in UTC', () => {
  expect(formatDay('2026-08-13T23:30:00Z')).toBe('13 ago 2026')
  expect(formatMonth('2026-08-13T23:30:00Z')).toBe('ago 2026')
})

test('one author concentrating is singular, two are plural', () => {
  expect(concentrationSentence({ authors: 1, percentage: 80 }, 42)).toBe('1 persona concentra 80% de los commits')
  expect(concentrationSentence({ authors: 2, percentage: 80 }, 42)).toBe('2 personas concentran 80% de los commits')
})

test('with no commits nobody has touched the repo', () => {
  const concentration: Concentration = { authors: 0, percentage: 0 }

  expect(concentrationSentence(concentration, 0)).toBe('Nadie ha tocado el repo en esta ventana.')
})

test('the long label of the full window is the whole history', () => {
  expect(windowLabelLong('30d')).toBe('30 días')
  expect(windowLabelLong('90d')).toBe('90 días')
  expect(windowLabelLong('12m')).toBe('12 meses')
  // `windowLabel` says just `todo` for the same window; the headline needs the long one.
  expect(windowLabelLong('all')).toBe('todo el historial')
  expect(noHeatHeadline('all')).toBe('Ninguna carpeta tocada en todo el historial')
})

test('the root reads as the whole repo', () => {
  expect(mainFolderLabel('')).toBe('todo el repo')
  expect(mainFolderLabel('web/src')).toBe('web/src')
})

test('one touched child is singular, two are plural', () => {
  expect(heatFooter(1, 12, 340)).toBe('1 hijo tocado · 12 commits aquí · total de la carpeta principal 340')
  expect(heatFooter(2, 12, 340)).toBe('2 hijos tocados · 12 commits aquí · total de la carpeta principal 340')
})

test('with no touched children the footer says the tree is still there', () => {
  expect(heatFooter(0, 0, 340)).toBe('El árbol sigue ahí; en esta ventana nadie lo ha tocado.')
})

test('the fallback notice names the folder it fell back to', () => {
  expect(fallbackNotice('web/src')).toBe(
    'La carpeta principal guardada ya no existe en HEAD: el calor se acota a web/src.',
  )
  expect(fallbackNotice('')).toBe(
    'La carpeta principal guardada ya no existe en HEAD: el calor se acota a todo el repo.',
  )
})

test('the empty window sentence drops the last commit clause when there is none', () => {
  const now = new Date('2026-08-19T12:00:00Z')

  expect(emptyWindowSentence('2026-05-27T12:00:00Z', now)).toBe(
    'Es una respuesta, no un fallo: el repo está quieto en esta ventana. Su último commit fue hace 84 días.',
  )
  expect(emptyWindowSentence(null, now)).toBe(
    'Es una respuesta, no un fallo: el repo está quieto en esta ventana.',
  )
  expect(emptyWindowSentence(null, now)).not.toContain('último commit')
})

test('the analysing headline names the repo it is walking', () => {
  expect(analysingHeadline('tienda-web')).toBe('Analizando tienda-web…')
})

test('the empty window headline names the window in its long form', () => {
  expect(emptyWindowHeadline('30d')).toBe('0 commits en 30 días')
  expect(emptyWindowHeadline('all')).toBe('0 commits en todo el historial')
})

test('the cta offers the default window by its long name', () => {
  expect(emptyWindowCtaLabel(DEFAULT_WINDOW)).toBe('Ver 12 meses')
  expect(emptyWindowCtaLabel('all')).toBe('Ver todo el historial')
})

test('the not-a-git-repo sentence names the folder', () => {
  expect(notAGitRepoSentence('notas-producto')).toBe(
    'En la carpeta notas-producto no hay ningún directorio .git, así que no hay historial que medir.',
  )
})

test('the no-commits sentence names the repo', () => {
  expect(noCommitsSentence('sandbox-notas')).toBe(
    'sandbox-notas es un repo git válido, pero su historial está vacío. No hay pulso que contar todavía.',
  )
})

test('the fresh snapshot line and the stale one differ in more than the date', () => {
  const now = new Date('2026-08-19T12:00:00Z')

  expect(freshSnapshotLine('2026-08-19T09:00:00Z', now)).toBe('Foto local al día · traída hoy')
  expect(staleSnapshotLine('2026-07-24T12:00:00Z', now)).toBe('Foto local traída hace 26 días')
})

test('the stale banner says how long ago the clone was fetched', () => {
  const now = new Date('2026-08-19T12:00:00Z')

  expect(staleBannerSentence('2026-07-24T12:00:00Z', now)).toBe(
    'Foto local desactualizada: el clon se trajo hace 26 días. Lo que ves puede ir por detrás del remoto.',
  )
})
