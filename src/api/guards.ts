import { ApiError } from './errors'

type BreedRecord = Record<string, string[]>

function shapeError(what: string): ApiError {
  return new ApiError('shape', `Unexpected response from the dog API: ${what}`)
}

/** Narrows an unknown response body to a successful Dog CEO envelope and returns its message. */
function successMessage(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw shapeError('body is not an object')
  }
  if (!('status' in body) || body.status !== 'success') {
    throw shapeError('status is not "success"')
  }
  if (!('message' in body)) {
    throw shapeError('message is missing')
  }
  return body.message
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/** Validates the /breeds/list/all response and returns the breed -> sub-breeds record. */
export function parseBreedList(body: unknown): BreedRecord {
  const message = successMessage(body)
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    throw shapeError('breed list is not an object')
  }
  const record: BreedRecord = {}
  for (const [breed, subs] of Object.entries(message)) {
    if (!isStringArray(subs)) {
      throw shapeError(`sub-breeds of "${breed}" are not a list of strings`)
    }
    record[breed] = subs
  }
  return record
}

/** Validates a random-image response and returns the image URL. */
export function parseImageResponse(body: unknown): string {
  const message = successMessage(body)
  if (typeof message !== 'string') {
    throw shapeError('image URL is not a string')
  }
  return message
}
