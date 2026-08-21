/**
 * The arithmetic and the navigation of the heat block, kept out of the
 * component so both can be pinned with exact strings instead of read off a
 * rendered DOM. Pure: entries in, bar widths and paths out — no React, no
 * fetch, no clock reads.
 */

import type { HeatEntry } from './api/types'

/** Rows the mockup draws at most (`rows.slice(0, 8)`). */
export const HEAT_ROW_LIMIT = 8

export interface HeatRow extends HeatEntry {
  /** CSS width of the bar, relative to the hottest row of the level */
  barWidth: string
  /** within 10% of the hottest row: drawn in the strongest ink */
  hottest: boolean
}

export function heatRows(children: readonly HeatEntry[]): HeatRow[] {
  const rows = children.slice(0, HEAT_ROW_LIMIT)
  const top = rows[0]?.percent ?? 0
  return rows.map((row) => ({
    ...row,
    barWidth: top === 0 ? '2.0%' : `${Math.max(2, (row.percent / top) * 100).toFixed(1)}%`,
    hottest: top > 0 && row.percent >= top * 0.9,
  }))
}

/** One step of the breadcrumb; `path` is what the API is asked for when it is clicked. */
export interface Crumb {
  label: string
  path: string
}

export function breadcrumb(repoName: string, mainFolder: string, path: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: mainFolder === '' ? repoName : mainFolder, path: mainFolder }]
  const below =
    mainFolder === '' ? path : path.startsWith(`${mainFolder}/`) ? path.slice(mainFolder.length + 1) : ''
  let walked = mainFolder
  for (const segment of below.split('/').filter((part) => part !== '')) {
    walked = walked === '' ? segment : `${walked}/${segment}`
    crumbs.push({ label: segment, path: walked })
  }
  return crumbs
}

export function mainFolderOptions(
  mainFolder: string,
  path: string,
  children: readonly HeatEntry[],
): string[] {
  const options = ['']
  // The labels are irrelevant here, so the repo name is not asked for: only
  // the `path` of each walked level is, and that one never depends on it.
  for (const crumb of breadcrumb('', mainFolder, path)) {
    if (crumb.path !== '') options.push(crumb.path)
  }
  options.push(mainFolder)
  for (const child of children) {
    if (child.kind === 'dir') options.push(path === '' ? child.name : `${path}/${child.name}`)
  }
  return [...new Set(options)]
}
