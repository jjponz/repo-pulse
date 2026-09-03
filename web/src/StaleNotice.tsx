import type { CSSProperties, ReactElement } from 'react'
import { staleBannerSentence } from './format'

export interface BannerProps {
  fetchedAt: string
  now: Date
}

export class StaleNotice {
  static Banner({ fetchedAt, now }: BannerProps): ReactElement {
    return (
      <div role="status" style={StaleNotice.BANNER_STYLE}>
        <div style={StaleNotice.SENTENCE_STYLE}>{staleBannerSentence(fetchedAt, now)}</div>
      </div>
    )
  }

  private static readonly BANNER_STYLE: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 16px',
    background: 'color-mix(in srgb, var(--color-accent-2) 8%, var(--color-bg))',
    borderLeft: '3px solid var(--color-accent-2)',
  }

  private static readonly SENTENCE_STYLE: CSSProperties = {
    flex: 1,
    fontSize: '17px',
    color: 'var(--color-accent-2-700)',
  }
}
