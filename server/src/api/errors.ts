import { AnalysisError } from '../analysis/index.js'
import type { ErrorRequestHandler } from 'express'

/**
 * Every failure leaves this API as `{error: {code, message}}`. The UI tells the
 * cases apart by the CODE (each one has its own screen in the mockup); the
 * status keeps HTTP honest about who is at fault.
 */

export type ApiErrorCode =
  | 'unknown-repo'
  | 'not-a-git-repo'
  | 'invalid-window'
  | 'invalid-body'
  | 'not-found'
  | 'git-failed'
  | 'internal'

const STATUS: Readonly<Record<ApiErrorCode, number>> = {
  'unknown-repo': 404,
  'not-a-git-repo': 422,
  'invalid-window': 400,
  'invalid-body': 400,
  // No endpoint at that URL under '/api'. Like `internal`, it is not a case the
  // UI draws a screen for: it exists so that NOTHING under '/api' can answer
  // outside the envelope, which is what the UI parses.
  'not-found': 404,
  'git-failed': 500,
  internal: 500,
}

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/**
 * Last middleware of the app: it turns anything a handler throws — including a
 * rejected async handler, which Express 5 forwards here on its own — into the
 * typed body above.
 */
export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  // Nothing can be added to a response already on the wire: hand it back to
  // Express, which closes the connection.
  if (response.headersSent) {
    next(error)
    return
  }
  const { code, message } = describe(error)
  response.status(STATUS[code]).json({ error: { code, message } })
}

function describe(error: unknown): { code: ApiErrorCode; message: string } {
  if (error instanceof ApiError) return { code: error.code, message: error.message }
  // The analysis module's codes ARE codes of this API: a folder that is not a
  // clone is the client's fault (422), a git that fails is ours (500).
  if (error instanceof AnalysisError) return { code: error.code, message: error.message }
  // How `express.json()` reports a body that is not JSON.
  if (error instanceof SyntaxError && 'body' in error) {
    return { code: 'invalid-body', message: 'the request body is not valid JSON' }
  }
  // And how it reports one past its 100 kB limit. It is the client's fault like
  // the malformed one is, so it gets the same code: otherwise the only body
  // this API accepts, `{mainFolder}`, could answer 500 to a bad request.
  if (isTooLarge(error)) {
    return { code: 'invalid-body', message: 'the request body is too large' }
  }
  return { code: 'internal', message: error instanceof Error ? error.message : String(error) }
}

/** `body-parser` tags what it refuses with a `type`; this is its "over the limit" one. */
function isTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  )
}
