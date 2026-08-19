import type { Kpis, TimeWindow, Trend } from './api/types'
import { previousWindowLabel, trendArrow, trendHeadline, trendSentence } from './format'

export interface TrendPanelProps {
  window: TimeWindow
  trend: Trend
  kpis: Kpis
}

/**
 * The trend block of the mockup: how this window compares with the previous
 * one. Whether there is anything to compare is the API's judgement, read off
 * `trend.comparable` and `trend.reason`; the panel never works it out from the
 * window it is drawing.
 */
export default function TrendPanel({ window, trend, kpis }: TrendPanelProps) {
  const color = headlineColor(trend)

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        borderBottom: '1px solid var(--color-text)',
        paddingBottom: '20px',
      }}
    >
      <div
        style={{
          fontSize: '13px',
          letterSpacing: '.22em',
          textTransform: 'uppercase',
          color: 'var(--color-neutral-600)',
        }}
      >
        {`tendencia vs ${previousWindowLabel(window)}`}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <div
          data-testid="trend-headline"
          style={{ fontSize: '72px', fontWeight: 600, lineHeight: 1, color, fontVariantNumeric: 'tabular-nums' }}
        >
          {trendHeadline(trend)}
        </div>
        <div style={{ fontSize: '34px', color }}>{trendArrow(trend)}</div>
      </div>
      <div style={{ fontSize: '17px', color: 'var(--color-neutral-800)' }}>
        {trendSentence(trend, kpis.commits)}
      </div>
      <div style={{ display: 'flex', gap: '28px', paddingTop: '18px' }}>
        {[
          { id: 'commits', label: 'commits', value: kpis.commits },
          { id: 'active-authors', label: 'autores activos', value: kpis.activeAuthors },
          { id: 'files-touched', label: 'ficheros tocados', value: kpis.filesTouched },
        ].map((kpi) => (
          <div key={kpi.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              data-testid={`kpi-${kpi.id}`}
              style={{ fontSize: '30px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              {kpi.value}
            </span>
            <span style={{ fontSize: '15px', color: 'var(--color-neutral-600)' }}>{kpi.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Grey when there is nothing to compare, so the dash does not read as a value. */
function headlineColor(trend: Trend): string {
  if (!trend.comparable || trend.percentage === null) return 'var(--color-neutral-600)'
  return trend.percentage >= 0 ? 'var(--color-accent-700)' : 'var(--color-accent-2-700)'
}
