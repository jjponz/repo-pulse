import type { Summary } from './api/types'
import { bucketNoun, formatEdge, previousWindowLabel } from './format'
import { PULSE_GEOMETRY, areaPoints, polylinePoints, seriesMax } from './series-points'

export interface PulseProps {
  summary: Summary
}

/**
 * The pulse block of the mockup: commits per bucket, with the equally long
 * previous window in grey behind them. Both series are scaled against one
 * shared maximum — that is the whole point of the overlay, and the arithmetic
 * lives in `web/src/series-points.ts`. On the `all` window there is no
 * comparable previous period, so the grey series and its legend disappear.
 */
export default function Pulse({ summary }: PulseProps) {
  const { bucket, buckets, from, previousWindowBuckets, to, window } = summary
  const commits = buckets.map((entry) => entry.commits)
  const max = seriesMax(commits, previousWindowBuckets ?? [])
  const current = polylinePoints(commits, max)

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
    </section>
  )
}
