import { Fragment } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { Summary, TimeWindow } from './api/types'
import {
  bucketNoun,
  emptyWindowCtaLabel,
  emptyWindowHeadline,
  emptyWindowSentence,
  formatEdge,
  previousWindowLabel,
} from './format'
import type { Activity, EmptyWindowCta } from './screen'
import { PULSE_GEOMETRY, areaPoints, polylinePoints, seriesMax } from './series-points'

export interface PulseProps {
  summary: Summary
  activity: Activity
  onWindow: (window: TimeWindow) => void
  now: Date
}

/**
 * The pulse block of the mockup: commits per bucket, with the equally long
 * previous window in grey behind them. Both series are scaled against one
 * shared maximum — that is the whole point of the overlay, and the arithmetic
 * lives in `web/src/series-points.ts`. On the `all` window there is no
 * comparable previous period, so the grey series and its legend disappear.
 * Whether there is anything to draw at all is `activity`'s answer, decided in
 * `web/src/screen.ts`: the block never works it out from the KPIs itself.
 */
export default function Pulse({ summary, activity, onWindow, now }: PulseProps) {
  const { bucket, previousWindowBuckets, window } = summary

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '30px', fontWeight: 600 }}>Pulso</h2>
          <div style={{ fontSize: '17px', color: 'var(--color-neutral-600)' }}>
            ¿está vivo? ¿va a más o a menos?
          </div>
        </div>
        <div style={{ fontSize: '16px', color: 'var(--color-neutral-600)' }}>
          {`commits por ${bucketNoun(bucket)}`}
          {previousWindowBuckets !== null && ` · gris = ${previousWindowLabel(window)}`}
        </div>
      </div>
      {activityBody({ summary, activity, onWindow, now })}
    </section>
  )
}

/**
 * The chart or what stands in for it, dispatched over the closed vocabulary
 * with no default branch: the declared return type is what turns a new member
 * of `Activity` into a compilation error instead of a blank chart.
 */
function activityBody({ summary, activity, onWindow, now }: PulseProps): ReactElement {
  switch (activity.kind) {
    case 'series':
      return seriesBody(summary)
    case 'empty-window':
      return emptyWindowBody(summary, activity.cta, onWindow, now)
  }
}

function seriesBody(summary: Summary): ReactElement {
  const { buckets, from, previousWindowBuckets, to, window } = summary
  const commits = buckets.map((entry) => entry.commits)
  const max = seriesMax(commits, previousWindowBuckets ?? [])
  const current = polylinePoints(commits, max)

  return (
    <Fragment>
      <svg
        viewBox={`0 0 ${PULSE_GEOMETRY.width} 200`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Pulso"
        style={{ width: '100%', height: '250px', display: 'block' }}
      >
        {previousWindowBuckets !== null && (
          <polyline
            data-testid="pulse-previous"
            points={polylinePoints(previousWindowBuckets, max)}
            fill="none"
            stroke="var(--color-neutral-400)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polygon points={areaPoints(current)} fill="var(--color-accent-200)" />
        <polyline
          data-testid="pulse-current"
          points={current}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="0"
          y1={PULSE_GEOMETRY.baseline}
          x2={PULSE_GEOMETRY.width}
          y2={PULSE_GEOMETRY.baseline}
          stroke="var(--color-text)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '15px',
          color: 'var(--color-neutral-600)',
        }}
      >
        <span>{formatEdge(from, window)}</span>
        <span>{`${buckets.length} cubos`}</span>
        <span style={{ color: 'var(--color-text)' }}>{formatEdge(to, window)}</span>
      </div>
    </Fragment>
  )
}

/** As tall as the chart it replaces, so the blocks grid does not jump. */
function emptyWindowBody(
  summary: Summary,
  cta: EmptyWindowCta,
  onWindow: (window: TimeWindow) => void,
  now: Date,
): ReactElement {
  return (
    <div style={EMPTY_WINDOW_STYLE}>
      <div style={{ fontSize: '58px', fontWeight: 600, lineHeight: 1 }}>{emptyWindowHeadline(summary.window)}</div>
      <div style={{ fontSize: '19px', color: 'var(--color-neutral-800)', maxWidth: '640px' }}>
        {emptyWindowSentence(summary.meta.lastCommitAt, now)}
      </div>
      <div style={{ paddingTop: '6px' }}>{ctaBody(cta, onWindow)}</div>
    </div>
  )
}

/**
 * The way out of the empty window, dispatched over its own closed vocabulary:
 * on the window the call to action points at there is nowhere left to go, and a
 * button that leads nowhere is worse than its absence.
 */
function ctaBody(cta: EmptyWindowCta, onWindow: (window: TimeWindow) => void): ReactElement | null {
  switch (cta.kind) {
    case 'switch':
      return (
        <button
          type="button"
          onClick={() => {
            onWindow(cta.window)
          }}
          style={CTA_BUTTON_STYLE}
        >
          {emptyWindowCtaLabel(cta.window)}
        </button>
      )
    case 'already-there':
      return null
  }
}

const EMPTY_WINDOW_STYLE: CSSProperties = {
  height: '250px',
  borderBottom: '1px solid var(--color-neutral-300)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '12px',
}

const CTA_BUTTON_STYLE: CSSProperties = {
  border: '1px solid var(--color-accent)',
  background: 'transparent',
  color: 'var(--color-accent-700)',
  fontSize: '16px',
  padding: '8px 14px',
}
