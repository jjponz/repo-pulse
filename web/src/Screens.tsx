import type { CSSProperties, ReactElement } from 'react'
import type { ApiErrorCode, Clone } from './api/types'
import {
  analysingHeadline,
  DETECTED_CLONES_LABEL,
  NO_COMMITS_FOOTNOTE,
  NO_COMMITS_HEADLINE,
  NOT_A_GIT_REPO_HEADLINE,
  noCommitsSentence,
  notAGitRepoSentence,
} from './format'

export interface AnalysingProps {
  repoName: string
}

export interface NotAGitRepoProps {
  repoId: string
  clones: readonly Clone[]
  onRepo: (id: string) => void
}

export interface NoCommitsProps {
  repoName: string
}

export interface FailedProps {
  code: ApiErrorCode
}

export class Screens {
  static Analysing({ repoName }: AnalysingProps): ReactElement {
    return (
      <div style={Screens.screenStyle('28px')}>
        <div style={Screens.HEADLINE_STYLE}>{analysingHeadline(repoName)}</div>
        <div role="progressbar" style={Screens.PROGRESS_TRACK_STYLE}>
          <div style={Screens.PROGRESS_BAR_STYLE} />
        </div>
      </div>
    )
  }

  static NotAGitRepo({ repoId, clones, onRepo }: NotAGitRepoProps): ReactElement {
    return (
      <div style={Screens.screenStyle('22px')}>
        <div style={Screens.HEADLINE_STYLE}>{NOT_A_GIT_REPO_HEADLINE}</div>
        <div style={Screens.SENTENCE_STYLE}>{notAGitRepoSentence(repoId)}</div>
        <div style={Screens.CLONE_LIST_STYLE}>
          <div style={Screens.LABEL_STYLE}>{DETECTED_CLONES_LABEL}</div>
          {clones.map((clone) => (
            <button
              key={clone.id}
              type="button"
              onClick={() => {
                onRepo(clone.id)
              }}
              style={Screens.CLONE_BUTTON_STYLE}
            >
              {clone.name}
              <span style={Screens.CLONE_PATH_STYLE}>{` · ${clone.path}`}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  static NoCommits({ repoName }: NoCommitsProps): ReactElement {
    return (
      <div style={Screens.screenStyle('20px')}>
        <div style={Screens.HEADLINE_STYLE}>{NO_COMMITS_HEADLINE}</div>
        <div style={Screens.SENTENCE_STYLE}>{noCommitsSentence(repoName)}</div>
        <div style={Screens.FOOTNOTE_STYLE}>{NO_COMMITS_FOOTNOTE}</div>
      </div>
    )
  }

  static Failed({ code }: FailedProps): ReactElement {
    return <p role="alert">{`No se ha podido cargar la información (${code}).`}</p>
  }

  private static screenStyle(gap: string): CSSProperties {
    return { padding: '40px 0', display: 'flex', flexDirection: 'column', gap, maxWidth: '760px' }
  }

  private static readonly HEADLINE_STYLE: CSSProperties = {
    fontSize: '40px',
    fontWeight: 600,
  }

  private static readonly SENTENCE_STYLE: CSSProperties = {
    fontSize: '19px',
    lineHeight: 1.55,
    color: 'var(--color-neutral-800)',
  }

  private static readonly FOOTNOTE_STYLE: CSSProperties = {
    fontSize: '16px',
    color: 'var(--color-neutral-600)',
  }

  private static readonly PROGRESS_TRACK_STYLE: CSSProperties = {
    height: '4px',
    background: 'var(--color-neutral-300)',
    overflow: 'hidden',
  }

  private static readonly PROGRESS_BAR_STYLE: CSSProperties = {
    width: '33%',
    height: '100%',
    background: 'var(--color-accent)',
    animation: 'rp-sweep 1.4s ease-in-out infinite',
  }

  private static readonly CLONE_LIST_STYLE: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingTop: '6px',
  }

  private static readonly LABEL_STYLE: CSSProperties = {
    fontSize: '13px',
    letterSpacing: '.22em',
    textTransform: 'uppercase',
    color: 'var(--color-neutral-600)',
  }

  private static readonly CLONE_BUTTON_STYLE: CSSProperties = {
    textAlign: 'left',
    border: 0,
    borderBottom: '1px solid var(--color-neutral-300)',
    background: 'transparent',
    padding: '6px 0',
    fontSize: '19px',
    color: 'var(--color-accent-700)',
  }

  private static readonly CLONE_PATH_STYLE: CSSProperties = {
    color: 'var(--color-neutral-600)',
  }
}
