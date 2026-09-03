import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { ApiError, fetchRepos, fetchSummary } from './api/client'
import { DEFAULT_WINDOW } from './api/types'
import type { ApiErrorCode, Clone, TimeWindow } from './api/types'
import Header from './Header'
import HeatBlock from './Heat'
import People from './People'
import Pulse from './Pulse'
import { ScreenChoice } from './screen'
import type { Screen, SummaryLoad } from './screen'
import { Screens } from './Screens'
import { StaleNotice } from './StaleNotice'
import TrendPanel from './TrendPanel'

/**
 * The shell: it owns the whole state of the dashboard (the clones, the
 * selected one, the window and the single load of its summary) and asks
 * `web/src/screen.ts` which screen that state is. Both loads run through
 * `web/src/api/client.ts`.
 */
export default function App() {
  const [repos, setRepos] = useState<readonly Clone[]>([])
  const [repoId, setRepoId] = useState('')
  const [window, setWindow] = useState<TimeWindow>(DEFAULT_WINDOW)
  const [load, setLoad] = useState<SummaryLoad>({ status: 'loading' })
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
        setLoad({ status: 'failed', code: codeOf(caught) })
      }
    }
  }, [])

  useEffect(() => {
    if (repoId === '') return
    const controller = new AbortController()
    setLoad({ status: 'loading' })
    void loadSummary(controller.signal)
    return () => {
      controller.abort()
    }

    async function loadSummary(signal: AbortSignal): Promise<void> {
      try {
        const summary = await fetchSummary(repoId, window, signal)
        if (signal.aborted) return
        setLoad({ status: 'loaded', summary })
      } catch (caught) {
        if (signal.aborted) return
        setLoad({ status: 'failed', code: codeOf(caught) })
      }
    }
  }, [repoId, window])

  const { screen, history, snapshot } = ScreenChoice.of({ repos, repoId, load })

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
        history={history}
        snapshot={snapshot}
        now={now}
      />
      {snapshot.kind === 'stale' && <StaleNotice.Banner fetchedAt={snapshot.fetchedAt} now={now} />}
      {screenBody(screen, { repoId, window, onRepo: setRepoId })}
    </main>
  )
}

/** What the body needs from the shell and the screen does not carry. */
interface Shell {
  repoId: string
  window: TimeWindow
  onRepo: (id: string) => void
}

/**
 * The body under the header, dispatched over the closed vocabulary with no
 * default branch: the declared return type is what turns a new member of
 * `Screen` into a compilation error instead of a blank page.
 */
function screenBody(screen: Screen, shell: Shell): ReactElement {
  switch (screen.kind) {
    case 'analysing':
      return <Screens.Analysing repoName={screen.repoName} />
    case 'not-a-git-repo':
      return <Screens.NotAGitRepo repoId={screen.repoId} clones={screen.clones} onRepo={shell.onRepo} />
    case 'no-commits':
      return <Screens.NoCommits repoName={screen.repoName} />
    case 'failed':
      return <Screens.Failed code={screen.code} />
    case 'blocks':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 440px', gap: 64, alignItems: 'start' }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 48 }}>
            <Pulse summary={screen.summary} />
            <People summary={screen.summary} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <TrendPanel window={shell.window} trend={screen.summary.trend} kpis={screen.summary.kpis} />
            <HeatBlock
              key={`${shell.repoId}|${shell.window}`}
              repoId={shell.repoId}
              repoName={screen.repoName}
              window={shell.window}
            />
          </div>
        </div>
      )
  }
}

/** Anything that is not an `ApiError` never reached the envelope: `internal`. */
function codeOf(caught: unknown): ApiErrorCode {
  return caught instanceof ApiError ? caught.code : 'internal'
}
