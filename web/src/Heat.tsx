import { Fragment, useEffect, useState } from 'react'
import { ApiError, fetchHeat, saveMainFolder } from './api/client'
import type { ApiErrorCode, Heat, TimeWindow } from './api/types'
import { fallbackNotice, heatFooter, mainFolderLabel, noHeatHeadline } from './format'
import { breadcrumb, heatRows, mainFolderOptions } from './heat-rows'
import type { HeatRow } from './heat-rows'

export interface HeatBlockProps {
  repoId: string
  repoName: string
  window: TimeWindow
}

/**
 * The heat block of the mockup: which children of one level burn, and how to
 * walk the tree. The level is the block's own state and nothing else's — no
 * other block navigates — and it starts as `undefined` so the server anchors
 * the first level at the saved main folder instead of the UI guessing where
 * that is. Files are the bottom: they are drawn, they are not walked into.
 */
export default function HeatBlock({ repoId, repoName, window }: HeatBlockProps) {
  const [path, setPath] = useState<string | undefined>(undefined)
  const [heat, setHeat] = useState<Heat | null>(null)
  const [error, setError] = useState<ApiErrorCode | null>(null)
  // Bumped by a save so the level reloads even when `path` did not change,
  // which is every save made from an already re-anchored level.
  const [revision, setRevision] = useState(0)
  const [saveError, setSaveError] = useState<ApiErrorCode | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setHeat(null)
    setError(null)
    setSaveError(null)
    void loadHeat(controller.signal)
    return () => {
      controller.abort()
    }

    async function loadHeat(signal: AbortSignal): Promise<void> {
      try {
        const loaded = await fetchHeat(repoId, window, path, signal)
        if (signal.aborted) return
        setHeat(loaded)
      } catch (caught) {
        if (signal.aborted) return
        setError(codeOf(caught))
      }
    }
  }, [repoId, window, path, revision])

  /**
   * Saves the folder and only then moves: the level goes back to "none asked
   * for" so the server re-anchors it inside the new folder. A rejected save
   * leaves both the level and the drawing alone — what is saved rules.
   */
  async function chooseMainFolder(mainFolder: string): Promise<void> {
    try {
      await saveMainFolder(repoId, mainFolder)
    } catch (caught) {
      setSaveError(codeOf(caught))
      return
    }
    setPath(undefined)
    setRevision((n) => n + 1)
  }

  const crumbs = heat === null ? [] : breadcrumb(repoName, heat.mainFolder, heat.path)
  const rows = heat === null ? [] : heatRows(heat.children)
  // The crumb right above the current one: `undefined` on the first crumb,
  // which is where there is nowhere to go up to.
  const parent = crumbs.at(-2)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '30px', fontWeight: 600 }}>Calor</h2>
          <div style={{ fontSize: '17px', color: 'var(--color-neutral-600)' }}>¿dónde arde?</div>
        </div>
        <button
          type="button"
          disabled={parent === undefined}
          onClick={() => {
            if (parent !== undefined) setPath(parent.path)
          }}
          style={{
            border: 0,
            background: 'transparent',
            padding: 0,
            fontSize: '16px',
            color: parent === undefined ? 'var(--color-neutral-400)' : 'var(--color-accent-700)',
          }}
        >
          ← subir
        </button>
      </div>
      {error !== null && <p role="alert">No se ha podido cargar el calor ({error}).</p>}
      {heat !== null && (
        <>
          <nav
            data-testid="heat-breadcrumb"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
              fontSize: '18px',
              flexWrap: 'wrap',
            }}
          >
            {crumbs.map((crumb, index) => (
              <Fragment key={crumb.path}>
                <button
                  type="button"
                  onClick={() => {
                    setPath(crumb.path)
                  }}
                  style={{
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    fontSize: '18px',
                    color:
                      index === crumbs.length - 1 ? 'var(--color-text)' : 'var(--color-accent-700)',
                    fontWeight: index === crumbs.length - 1 ? 600 : 400,
                  }}
                >
                  {crumb.label}
                </button>
                {index < crumbs.length - 1 && (
                  <span style={{ color: 'var(--color-neutral-400)' }}>/</span>
                )}
              </Fragment>
            ))}
          </nav>
          {heat.fallback && (
            <div style={{ fontSize: '16px', color: 'var(--color-accent-2-700)' }}>
              {fallbackNotice(heat.mainFolder)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span
              style={{
                fontSize: '13px',
                letterSpacing: '.22em',
                textTransform: 'uppercase',
                color: 'var(--color-neutral-600)',
              }}
            >
              carpeta principal
            </span>
            <select
              aria-label="Carpeta principal"
              value={heat.mainFolder}
              onChange={(event) => {
                void chooseMainFolder(event.target.value)
              }}
              style={{
                background: 'transparent',
                border: 0,
                borderBottom: '1px solid var(--color-text)',
                fontSize: '16px',
                color: 'var(--color-text)',
              }}
            >
              {mainFolderOptions(heat.mainFolder, heat.path, heat.children).map((option) => (
                <option key={option} value={option}>
                  {mainFolderLabel(option)}
                </option>
              ))}
            </select>
          </div>
          {saveError !== null && (
            <p role="alert">No se ha podido guardar la carpeta principal ({saveError}).</p>
          )}
          {rows.length === 0 ? (
            <div style={{ padding: '16px 0 6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '26px', fontWeight: 600 }}>{noHeatHeadline(window)}</div>
              <div style={{ fontSize: '17px', color: 'var(--color-neutral-800)' }}>
                Sin commits en la ventana no hay reparto que medir.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {rows.map((row) =>
                row.kind === 'dir' ? (
                  <button
                    key={row.name}
                    type="button"
                    data-testid="heat-row"
                    onClick={() => {
                      setPath(heat.path === '' ? row.name : `${heat.path}/${row.name}`)
                    }}
                    style={ROW_STYLE}
                  >
                    {rowCells(row)}
                  </button>
                ) : (
                  <div key={row.name} data-testid="heat-row" style={ROW_STYLE}>
                    {rowCells(row)}
                  </div>
                ),
              )}
            </div>
          )}
          <div style={{ fontSize: '15px', color: 'var(--color-neutral-600)', lineHeight: 1.45 }}>
            {heatFooter(heat.children.length, heat.commits, heat.mainFolderCommits)}
            {' · el % es sobre el total de la carpeta principal.'}
          </div>
        </>
      )}
    </section>
  )
}

const ROW_STYLE = {
  position: 'relative',
  border: 0,
  borderBottom: '1px solid var(--color-neutral-300)',
  background: 'transparent',
  padding: '12px 0',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'baseline',
  gap: '12px',
} as const

/** The cells of one row, shared by the folder button and the file div. */
function rowCells(row: HeatRow) {
  return (
    <>
      <span
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: '3px',
          width: row.barWidth,
          background: row.kind === 'file' ? 'var(--color-accent-2)' : 'var(--color-accent)',
        }}
      />
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
        {row.kind === 'dir' ? `${row.name}/` : row.name}
      </span>
      <span
        style={{ fontSize: '16px', color: 'var(--color-neutral-600)', fontVariantNumeric: 'tabular-nums' }}
      >
        {row.commits}
      </span>
      <span
        style={{
          fontSize: '20px',
          fontWeight: 600,
          width: '66px',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: row.hottest ? 'var(--color-text)' : 'var(--color-neutral-800)',
        }}
      >
        {`${row.percent}%`}
      </span>
      <span style={{ fontSize: '16px', color: 'var(--color-neutral-400)', width: '12px' }}>
        {row.kind === 'dir' ? '›' : ''}
      </span>
    </>
  )
}

/** Anything that is not an `ApiError` never reached the envelope: `internal`. */
function codeOf(caught: unknown): ApiErrorCode {
  return caught instanceof ApiError ? caught.code : 'internal'
}
