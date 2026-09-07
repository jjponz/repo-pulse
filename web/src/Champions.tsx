import { useEffect, useState } from 'react'
import { ApiError, fetchCoverage } from './api/client'
import type { ApiErrorCode, Clone, RepoCoverage } from './api/types'
import { ChampionRows } from './champion-rows'

export interface ChampionsProps {
  repos: readonly Clone[]
  repoId: string
  now: Date
}

export default function Champions({ repos, repoId, now }: ChampionsProps) {
  const [coverage, setCoverage] = useState<readonly RepoCoverage[] | null>(null)
  const [error, setError] = useState<ApiErrorCode | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void loadCoverage(controller.signal)
    return () => {
      controller.abort()
    }

    async function loadCoverage(signal: AbortSignal): Promise<void> {
      try {
        const loaded = await fetchCoverage(signal)
        if (signal.aborted) return
        setCoverage(loaded)
      } catch (caught) {
        if (signal.aborted) return
        setError(caught instanceof ApiError ? caught.code : 'internal')
      }
    }
  }, [])

  const measured = coverage === null ? [] : coverage.filter((entry) => entry.state === 'measured')
  const rows = coverage === null ? [] : ChampionRows.of(coverage, repos, repoId, now)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '30px', fontWeight: 600 }}>Campeones</h2>
        <div style={{ fontSize: '17px', color: 'var(--color-neutral-600)' }}>¿quién cubre más?</div>
      </div>
      {error !== null && <p role="alert">No se ha podido cargar la cobertura ({error}).</p>}
      {error === null && coverage !== null && measured.length === 0 && (
        <div style={{ fontSize: '20px', fontWeight: 600 }}>{ChampionRows.emptyHeadline()}</div>
      )}
      {error === null && coverage !== null && measured.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((row) => (
            <div
              key={row.id}
              data-testid="champion-row"
              aria-current={row.selected ? 'true' : undefined}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'baseline',
                gap: '12px',
                padding: '10px 0',
                borderBottom: '1px solid var(--color-neutral-300)',
                background: row.selected ? 'var(--color-accent-200)' : 'transparent',
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: '19px',
                  color: 'var(--color-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.name}
              </span>
              <span style={{ fontSize: '15px', color: 'var(--color-neutral-600)', width: '90px' }}>
                {row.source}
              </span>
              <span style={{ fontSize: '15px', color: 'var(--color-neutral-600)', width: '90px' }}>
                {row.age}
              </span>
              <div style={{ width: '80px' }}>
                {row.barPercent !== null && (
                  <div
                    data-testid="champion-bar"
                    style={{ height: '8px', background: 'var(--color-neutral-200)' }}
                  >
                    <div
                      style={{
                        width: `${row.barPercent}%`,
                        height: '100%',
                        background: 'var(--color-accent)',
                      }}
                    />
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  width: '110px',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--color-text)',
                }}
              >
                {row.headline}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
