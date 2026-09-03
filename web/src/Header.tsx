import type { CSSProperties, ReactElement } from 'react'
import type { Clone, TimeWindow } from './api/types'
import { WINDOWS } from './api/types'
import { formatDay, freshSnapshotLine, NO_HISTORY_META, relativeDays, staleSnapshotLine, windowLabel } from './format'
import type { HeaderHistory, SnapshotNotice } from './screen'

export interface HeaderProps {
  repos: readonly Clone[]
  repoId: string
  onRepo: (id: string) => void
  window: TimeWindow
  onWindow: (window: TimeWindow) => void
  history: HeaderHistory
  snapshot: SnapshotNotice
  now: Date
}

/**
 * The header of the mockup: which repo is being read, in which window, what its
 * history says and how fresh the local snapshot is. Every string it draws comes
 * from `web/src/format.ts`, and the two lines under the repo name are dispatched
 * over the vocabularies of `web/src/screen.ts` instead of derived from a pair of
 * payload fields.
 */
export default function Header({ repos, repoId, onRepo, window, onWindow, history, snapshot, now }: HeaderProps) {
  const selected = repos.find((repo) => repo.id === repoId) ?? null

  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '30px',
          borderBottom: '3px solid var(--color-text)',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '18px', minWidth: 0 }}>
          <select
            aria-label="Repositorio"
            value={repoId}
            onChange={(event) => {
              onRepo(event.target.value)
            }}
            style={{
              fontSize: '40px',
              fontWeight: 600,
              color: 'var(--color-text)',
              background: 'transparent',
              border: 0,
              padding: '0 24px 0 0',
              appearance: 'none',
              lineHeight: 1.1,
            }}
          >
            {repos.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
              </option>
            ))}
          </select>
          {selected !== null && (
            <div style={{ fontSize: '16px', color: 'var(--color-neutral-600)' }}>{selected.path}</div>
          )}
          {historyLine(history, now)}
        </div>
        <div style={{ display: 'flex', gap: '20px', fontSize: '18px', whiteSpace: 'nowrap' }}>
          {WINDOWS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-current={candidate === window ? true : undefined}
              onClick={() => {
                onWindow(candidate)
              }}
              style={{
                border: 0,
                background: 'transparent',
                padding: '2px 0',
                fontSize: '18px',
                color: candidate === window ? 'var(--color-text)' : 'var(--color-neutral-600)',
                borderBottom: `2px solid ${candidate === window ? 'var(--color-accent)' : 'transparent'}`,
              }}
            >
              {windowLabel(candidate)}
            </button>
          ))}
        </div>
      </div>
      {snapshotLine(snapshot, now)}
    </header>
  )
}

const HISTORY_LINE_STYLE: CSSProperties = { fontSize: '16px', color: 'var(--color-neutral-800)' }

/**
 * What the header says about the history of the selected clone, dispatched with
 * no default branch: `unknown` is a header without the line at all.
 */
function historyLine(history: HeaderHistory, now: Date): ReactElement | null {
  switch (history.kind) {
    case 'unknown':
      return null
    case 'none':
      return <div style={HISTORY_LINE_STYLE}>{NO_HISTORY_META}</div>
    case 'last-commit':
      return (
        <div style={HISTORY_LINE_STYLE}>
          último commit <strong style={{ fontWeight: 600 }}>{relativeDays(history.at, now)}</strong> ·{' '}
          {formatDay(history.at)}
        </div>
      )
  }
}

function snapshotLineStyle(color: string): CSSProperties {
  return { fontSize: '16px', color }
}

/**
 * The freshness of the local snapshot, dispatched with no default branch: a
 * clone that was never fetched has no line, not an empty one.
 */
function snapshotLine(snapshot: SnapshotNotice, now: Date): ReactElement | null {
  switch (snapshot.kind) {
    case 'never-fetched':
      return null
    case 'fresh':
      return (
        <div style={snapshotLineStyle('var(--color-neutral-600)')}>{freshSnapshotLine(snapshot.fetchedAt, now)}</div>
      )
    case 'stale':
      return (
        <div style={snapshotLineStyle('var(--color-accent-2-700)')}>{staleSnapshotLine(snapshot.fetchedAt, now)}</div>
      )
  }
}
