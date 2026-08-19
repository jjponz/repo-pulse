import { useEffect, useState } from 'react'
import { ApiError, fetchRepos, fetchSummary } from './api/client'
import { DEFAULT_WINDOW } from './api/types'
import type { ApiErrorCode, Clone, Summary, TimeWindow } from './api/types'
import Header from './Header'

/**
 * The shell: it owns the whole state of the dashboard (the clones, the
 * selected one, the window, its summary and the last error) and hands the
 * header what it draws. Both loads run through `web/src/api/client.ts`.
 */
export default function App() {
  const [repos, setRepos] = useState<readonly Clone[]>([])
  const [repoId, setRepoId] = useState('')
  const [window, setWindow] = useState<TimeWindow>(DEFAULT_WINDOW)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<ApiErrorCode | null>(null)
  // Read once: every relative phrase in a render is measured from the same
  // instant, and a re-render does not silently move the reference point.
  const [now] = useState(() => new Date())

  useEffect(() => {
    const controller = new AbortController()
    void loadRepos(controller.signal)
    return () => {
      controller.abort()
    }

    async function loadRepos(signal: AbortSignal): Promise<void> {
      try {
        const clones = await fetchRepos(signal)
        if (signal.aborted) return
        setRepos(clones)
        const first = clones[0]
        if (first !== undefined) setRepoId(first.id)
      } catch (caught) {
        if (signal.aborted) return
        setError(codeOf(caught))
      }
    }
  }, [])

  useEffect(() => {
    if (repoId === '') return
    const controller = new AbortController()
    setSummary(null)
    setError(null)
    void loadSummary(controller.signal)
    return () => {
      controller.abort()
    }

    async function loadSummary(signal: AbortSignal): Promise<void> {
      try {
        const loaded = await fetchSummary(repoId, window, signal)
        if (signal.aborted) return
        setSummary(loaded)
      } catch (caught) {
        if (signal.aborted) return
        setError(codeOf(caught))
      }
    }
  }, [repoId, window])

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '40px 56px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: '30px',
      }}
    >
      <Header
        repos={repos}
        repoId={repoId}
        onRepo={setRepoId}
        window={window}
        onWindow={setWindow}
        meta={summary?.meta ?? null}
        now={now}
      />
      {error !== null && <p role="alert">No se ha podido cargar la información ({error}).</p>}
      {error === null && summary === null && <p>Cargando…</p>}
    </main>
  )
}

/** Anything that is not an `ApiError` never reached the envelope: `internal`. */
function codeOf(caught: unknown): ApiErrorCode {
  return caught instanceof ApiError ? caught.code : 'internal'
}
