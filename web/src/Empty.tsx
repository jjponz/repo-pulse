import type { Bucket, TimeWindow } from './api/types'
import { emptyWindowHeadline, windowLabel } from './format'

export interface EmptyStateProps {
  window: TimeWindow
  /** `null` means the clone has no commits at all, in any window. */
  headSha: string | null
  onWindow: (window: TimeWindow) => void
}

/**
 * What takes the place of the data grid when the summary landed with nothing
 * to draw. Two states, told apart by `headSha` and not by the counts: an empty
 * window is a question of where to look, and a clone with no commits is not.
 * Only the first one offers the way out, because only the first one has one.
 */
export default function EmptyState({ window, headSha, onWindow }: EmptyStateProps) {
  const wider = headSha === null ? null : widerWindow(window)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
      <div style={{ fontSize: '34px', fontWeight: 600, lineHeight: 1.15 }}>
        {headSha === null ? 'Este clon todavía no tiene commits' : emptyWindowHeadline(window)}
      </div>
      <div style={{ fontSize: '17px', color: 'var(--color-neutral-800)' }}>
        {headSha === null
          ? 'No hay historial que leer: el clon está vacío.'
          : 'El historial existe; en esta ventana nadie lo ha tocado.'}
      </div>
      {wider !== null && (
        <button
          type="button"
          onClick={() => {
            onWindow(wider)
          }}
          style={{
            marginTop: '6px',
            border: '2px solid var(--color-accent)',
            background: 'transparent',
            color: 'var(--color-accent-700)',
            borderRadius: '2px',
            padding: '8px 18px',
            fontSize: '17px',
          }}
        >
          Ver {windowLabel(wider)}
        </button>
      )}
    </div>
  )
}

/**
 * The next window out, one step at a time: the narrow ones jump to the
 * default, the default jumps to the whole history, and `all` has nothing
 * wider behind it.
 */
function widerWindow(window: TimeWindow): TimeWindow | null {
  switch (window) {
    case '30d':
    case '90d':
      return '12m'
    case '12m':
      return 'all'
    case 'all':
      return null
  }
}

/** True when the window carries no commit at all, which is what empties the view. */
export function hasNoActivity(buckets: readonly Bucket[]): boolean {
  return buckets.every((bucket) => bucket.commits === 0)
}
