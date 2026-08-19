import { expect, test } from 'vitest'
import {
  bucketNoun,
  formatDay,
  formatEdge,
  formatMonth,
  previousWindowLabel,
  relativeDays,
  trendArrow,
  trendHeadline,
  trendSentence,
  windowLabel,
} from './format'
import type { Trend } from './api/types'

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
