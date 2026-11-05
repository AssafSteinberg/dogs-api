export type ApiErrorKind = 'network' | 'http' | 'shape'

/**
 * The one error type the API layer throws:
 * - network: the request never got an answer (offline, DNS, blocked)
 * - http: the server answered with a failure status
 * - shape: the answer was not what the API documents
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

/** The text of the red pop-up shown when the API cannot be used (FR-D-9). */
export const API_OUTAGE_MESSAGE = "Can't reach the dog.ceo API. Check your connection and try again."

/**
 * True when a failure means the API itself is unreachable or broken, so the red
 * pop-up should appear: no connection, an unusable answer, or a server error.
 * A 404 for one breed is not an outage.
 */
export function isApiOutage(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  if (error.kind === 'http') return error.status !== undefined && error.status >= 500
  return true
}
