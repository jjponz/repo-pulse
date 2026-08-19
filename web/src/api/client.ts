import type { ApiErrorCode, Clone, Summary, TimeWindow } from './types'

/**
 * Thrown by every function below for a response that is not `ok`, or one that
 * never arrives at all. The UI tells cases apart by `code`, never by an HTTP
 * status: the status is not looked at once the envelope has been read.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export async function fetchRepos(signal?: AbortSignal): Promise<Clone[]> {
  const body = await request<{ repos: Clone[] }>('/api/repos', signal)
  return body.repos
}

export async function fetchSummary(
  id: string,
  window: TimeWindow,
  signal?: AbortSignal,
): Promise<Summary> {
  return request<Summary>(`/api/repos/${encodeURIComponent(id)}/summary?window=${window}`, signal)
}

/**
 * Fetches `url` (relative, routed by the dev proxy of Task 1) and parses it as
 * `T`. A response that is not `ok` is read as the error envelope and thrown as
 * an `ApiError`; a request that fails before it gets a response — network
 * error, or an aborted signal — is reported the same way, with `code`
 * `'internal'`.
 */
async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    throw new ApiError('internal', messageOf(error))
  }
  if (!response.ok) throw await errorFrom(response)
  return (await response.json()) as T
}

/**
 * Reads `{error: {code, message}}` off a non-ok response. A body that is not
 * that shape — malformed JSON included — is not a case any screen draws: it
 * becomes `'internal'` instead of inventing a code the server never sends.
 */
async function errorFrom(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json()
    if (isErrorEnvelope(body)) return new ApiError(body.error.code, body.error.message)
  } catch {
    // Not JSON at all: falls through to the generic error below.
  }
  return new ApiError('internal', `request failed with status ${response.status}`)
}

function isErrorEnvelope(value: unknown): value is { error: { code: ApiErrorCode; message: string } } {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const error = (value as { error: unknown }).error
  if (typeof error !== 'object' || error === null) return false
  return typeof (error as { code: unknown }).code === 'string' && typeof (error as { message: unknown }).message === 'string'
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
