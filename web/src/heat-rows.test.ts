import { expect, test } from 'vitest'
import { HEAT_ROW_LIMIT, breadcrumb, heatRows, mainFolderOptions } from './heat-rows'
import type { HeatEntry } from './api/types'

function dir(name: string, percent: number, commits = percent): HeatEntry {
  return { name, kind: 'dir', commits, percent }
}

function file(name: string, percent: number, commits = percent): HeatEntry {
  return { name, kind: 'file', commits, percent }
}

test('the bar of the hottest row fills the level and the coldest keeps a stub', () => {
  const rows = heatRows([dir('web', 40), dir('server', 36), dir('docs', 1)])

  expect(rows.map((row) => row.barWidth)).toEqual(['100.0%', '90.0%', '2.5%'])
  // 36 is within 10% of 40 and burns as hot; 1 is not, and the bar it keeps is
  // the 2% stub that says "touched" without pretending to be readable.
  expect(rows.map((row) => row.hottest)).toEqual([true, true, false])

  // A colder level, where the proportional bar would fall under the stub: 1 of
  // 100 is 1.0%, and the floor lifts it to the same 2% minimum without ever
  // making it hot.
  const steep = heatRows([dir('web', 100), dir('docs', 1)])

  expect(steep.map((row) => row.barWidth)).toEqual(['100.0%', '2.0%'])
  expect(steep.map((row) => row.hottest)).toEqual([true, false])
})

test('a level with no commits still draws stub bars', () => {
  const rows = heatRows([dir('web', 0, 0), dir('server', 0, 0)])

  // Nothing to be relative to: every bar is the stub, and none of them is hot.
  expect(rows.map((row) => row.barWidth)).toEqual(['2.0%', '2.0%'])
  expect(rows.map((row) => row.hottest)).toEqual([false, false])
})

test('at most eight rows are drawn', () => {
  const rows = heatRows(Array.from({ length: 12 }, (_, index) => dir(`d${index}`, 100 - index)))

  expect(rows).toHaveLength(HEAT_ROW_LIMIT)
  // The order the server sent is the order kept: the cut is off the tail.
  expect(rows.map((row) => row.name)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'])
})

test('the breadcrumb starts at the repo when nothing is scoped', () => {
  // Nothing scoped: the root of the clone is named after the repo, not `''`.
  expect(breadcrumb('repo-pulse', '', 'web/src')).toEqual([
    { label: 'repo-pulse', path: '' },
    { label: 'web', path: 'web' },
    { label: 'src', path: 'web/src' },
  ])
})

test('the breadcrumb starts at the main folder and walks down to the level', () => {
  // `path` comes from the API with the main folder already on the front: the
  // steps below it are the ones that get their own crumb, and their `path`
  // stays absolute from the root of the clone.
  expect(breadcrumb('repo-pulse', 'web', 'web/src/api')).toEqual([
    { label: 'web', path: 'web' },
    { label: 'src', path: 'web/src' },
    { label: 'api', path: 'web/src/api' },
  ])
  // Sitting on the main folder itself is one single step.
  expect(breadcrumb('repo-pulse', 'web', 'web')).toEqual([{ label: 'web', path: 'web' }])
})

test('the options offer the root, the walked levels and the folders in sight', () => {
  // The API exposes no directory listing of its own, so what can be picked is
  // the root, the levels already walked and the `dir` children of this level.
  // Files are not folders and never show up.
  expect(
    mainFolderOptions('web', 'web/src', [dir('api', 60), file('App.tsx', 30), dir('testing', 10)]),
  ).toEqual(['', 'web', 'web/src', 'web/src/api', 'web/src/testing'])
  // At the root the children are their own bare paths, with no leading slash.
  expect(mainFolderOptions('', '', [dir('web', 70), file('README.md', 30)])).toEqual(['', 'web'])
})

test('the saved main folder is always an option', () => {
  // A level above the saved folder: the folder is still offered, once, even
  // though it is at the same time a child in sight — otherwise going back to
  // what is saved would need a round trip through the root.
  expect(mainFolderOptions('web/src', 'web', [dir('src', 100)])).toEqual(['', 'web/src'])
})
