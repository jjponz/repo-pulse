import { afterEach, expect, test } from 'vitest'
import { AnalyzeCoupling } from './coupling.js'
import { readDirectories, readHistory } from './git.js'
import { createRepoFixture } from '../testing/repo-fixture.js'
import type { CommitFixture, RepoFixture } from '../testing/repo-fixture.js'

const NOW = new Date('2026-08-13T12:00:00.000Z')

let fixture: RepoFixture | null = null

afterEach(() => {
  fixture?.cleanup()
  fixture = null
})

test('a pair with exactly the minimum co-occurrences appears and one fewer does not', async () => {
  fixture = createRepoFixture({
    commits: [
      { date: '2026-07-01T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-07-02T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-07-03T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-07-04T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-07-05T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-07-06T09:00:00+00:00', email: 'bea@example.com', files: ['src/a.ts', 'src/c.ts'] },
      { date: '2026-07-07T09:00:00+00:00', email: 'bea@example.com', files: ['src/a.ts', 'src/c.ts'] },
      { date: '2026-07-08T09:00:00+00:00', email: 'bea@example.com', files: ['src/a.ts', 'src/c.ts'] },
      { date: '2026-07-09T09:00:00+00:00', email: 'bea@example.com', files: ['src/a.ts', 'src/c.ts'] },
    ],
  })

  const coupling = await new AnalyzeCoupling(readDirectories, readHistory).run({
    repo: fixture.path,
    window: '12m',
    now: NOW,
  })

  expect(coupling.pairs).toEqual([{ a: 'a.ts', aKind: 'file', b: 'b.ts', bKind: 'file', coChanges: 5, percent: 100 }])
  expect(coupling.pairs.some((pair) => pair.a === 'a.ts' && pair.b === 'c.ts')).toBe(false)
})

test('the percent is over whichever child changes least, not over the total', async () => {
  const commits: CommitFixture[] = []
  for (let day = 1; day <= 5; day++) {
    commits.push({
      date: `2026-07-${String(day).padStart(2, '0')}T09:00:00+00:00`,
      email: 'ana@example.com',
      files: ['src/a.ts', 'src/b.ts'],
    })
  }
  for (let day = 6; day <= 20; day++) {
    commits.push({
      date: `2026-07-${String(day).padStart(2, '0')}T09:00:00+00:00`,
      email: 'bea@example.com',
      files: ['src/b.ts'],
    })
  }

  fixture = createRepoFixture({ commits })

  const coupling = await new AnalyzeCoupling(readDirectories, readHistory).run({
    repo: fixture.path,
    window: '12m',
    now: NOW,
  })

  const pair = coupling.pairs.find((entry) => entry.a === 'a.ts' && entry.b === 'b.ts')
  expect(pair).toMatchObject({ coChanges: 5, percent: 100 })
})

test('commits outside the window do not count towards coupling', async () => {
  fixture = createRepoFixture({
    commits: [
      { date: '2026-01-01T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-01-02T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-01-03T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-01-04T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-01-05T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-01-06T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-01-07T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-01-08T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-01-09T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-01-10T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-08-05T09:00:00+00:00', email: 'bea@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-08-06T09:00:00+00:00', email: 'bea@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-08-07T09:00:00+00:00', email: 'bea@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-08-08T09:00:00+00:00', email: 'bea@example.com', files: ['src/a.ts', 'src/b.ts'] },
    ],
  })

  const coupling = await new AnalyzeCoupling(readDirectories, readHistory).run({
    repo: fixture.path,
    window: '30d',
    now: NOW,
  })

  expect(coupling.pairs).toEqual([])
})

test('the coupling payload carries no author email or name', async () => {
  fixture = createRepoFixture({
    commits: [
      { date: '2026-07-01T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-07-02T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-07-03T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-07-04T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
      { date: '2026-07-05T09:00:00+00:00', email: 'ana@example.com', files: ['src/a.ts', 'src/b.ts'] },
    ],
  })

  const coupling = await new AnalyzeCoupling(readDirectories, readHistory).run({
    repo: fixture.path,
    window: '12m',
    now: NOW,
  })

  const serialized = JSON.stringify(coupling)
  expect(serialized).not.toContain('ana@example.com')
  expect(serialized).not.toContain('Fixture Author')
})
