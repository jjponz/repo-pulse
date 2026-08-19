import type { Clone, SummaryMeta, TimeWindow } from './api/types'
import { WINDOWS } from './api/types'
import { formatDay, relativeDays, windowLabel } from './format'

export interface HeaderProps {
  repos: readonly Clone[]
  repoId: string
  onRepo: (id: string) => void
  window: TimeWindow
  onWindow: (window: TimeWindow) => void
  /** `null` while the summary of the selected clone has not arrived yet. */
  meta: SummaryMeta | null
  now: Date
}

/**
 * The header of the mockup: which repo is being read, in which window, and how
 * fresh the local snapshot is. Every string it draws comes from
 * `web/src/format.ts`; both dated lines disappear whole when the API sends no
 * date, because a repo with no commits has neither.
 */
export default function Header({ repos, repoId, onRepo, window, onWindow, meta, now }: HeaderProps) {
  const selected = repos.find((repo) => repo.id === repoId) ?? null
  const lastCommitAt = meta?.lastCommitAt ?? null
  const fetchedAt = meta?.fetchedAt ?? null
  const stale = meta?.stale === true

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
          {lastCommitAt !== null && (
            <div style={{ fontSize: '16px', color: 'var(--color-neutral-800)' }}>
              último commit <strong style={{ fontWeight: 600 }}>{relativeDays(lastCommitAt, now)}</strong> ·{' '}
              {formatDay(lastCommitAt)}
            </div>
          )}
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
      {fetchedAt !== null && (
        <div
          style={{
            fontSize: '16px',
            color: stale ? 'var(--color-accent-2-700)' : 'var(--color-neutral-600)',
          }}
        >
          {stale
            ? `Foto local traída ${relativeDays(fetchedAt, now)}`
            : `Foto local al día · traída ${relativeDays(fetchedAt, now)}`}
        </div>
      )}
    </header>
  )
}
