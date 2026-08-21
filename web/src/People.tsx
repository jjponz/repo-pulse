import type { Summary } from './api/types'
import { bucketNoun, concentrationSentence } from './format'
import { PEOPLE_GEOMETRY, polylinePoints, seriesMax } from './series-points'

export interface PeopleProps {
  summary: Summary
}

/**
 * The people block of the mockup: how many distinct authors touch the repo per
 * bucket, and how much of the window the busiest of them concentrate. It draws
 * counts and percentages only — no author name or email ever reaches the DOM,
 * which is why the payload's identity fields do not exist in the first place.
 */
export default function People({ summary }: PeopleProps) {
  const { bucket, buckets, concentration, kpis } = summary
  const authors = buckets.map((entry) => entry.authors)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '30px', fontWeight: 600 }}>Gente</h2>
          <div style={{ fontSize: '17px', color: 'var(--color-neutral-600)' }}>
            ¿cuánta gente lo toca? ¿depende de pocos?
          </div>
        </div>
        <div style={{ fontSize: '16px', color: 'var(--color-neutral-600)' }}>
          {`autores activos por ${bucketNoun(bucket)}`}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${PEOPLE_GEOMETRY.width} 110`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Gente"
        style={{ width: '100%', height: '130px', display: 'block' }}
      >
        <polyline
          data-testid="people-authors"
          points={polylinePoints(authors, seriesMax(authors), PEOPLE_GEOMETRY)}
          fill="none"
          stroke="var(--color-accent-2)"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="0"
          y1={PEOPLE_GEOMETRY.baseline}
          x2={PEOPLE_GEOMETRY.width}
          y2={PEOPLE_GEOMETRY.baseline}
          stroke="var(--color-text)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingTop: '8px' }}>
        <div style={{ flex: 1, display: 'flex', height: '28px', border: '1px solid var(--color-text)' }}>
          <div
            data-testid="concentration-bar"
            style={{ width: `${concentration.percentage}%`, background: 'var(--color-text)' }}
          />
          <div style={{ flex: 1, background: 'var(--color-neutral-200)' }} />
        </div>
        <div style={{ fontSize: '20px', width: '300px', lineHeight: 1.3 }}>
          {concentrationSentence(concentration, kpis.commits)}
        </div>
      </div>
      <div style={{ fontSize: '15px', color: 'var(--color-neutral-600)' }}>
        Solo reparto: los nombres de los autores no aparecen en ninguna parte de la herramienta.
      </div>
    </section>
  )
}
