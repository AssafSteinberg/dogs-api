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
