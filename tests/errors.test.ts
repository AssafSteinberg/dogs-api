import { describe, expect, it } from 'vitest'
import { ApiError, isApiOutage } from '../src/api/errors'

describe('ApiError', () => {
  it('is an Error that carries its kind and message', () => {
    const error = new ApiError('network', 'Failed to fetch')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.name).toBe('ApiError')
    expect(error.kind).toBe('network')
    expect(error.message).toBe('Failed to fetch')
    expect(error.status).toBeUndefined()
  })

  it('carries the HTTP status for an http error', () => {
    const error = new ApiError('http', 'Breed not found', 404)
    expect(error.kind).toBe('http')
    expect(error.status).toBe(404)
  })
})

describe('isApiOutage (when the red pop-up is raised, FR-D-9)', () => {
  it.each([
    ['a network error', new ApiError('network', 'Failed to fetch')],
    ['an unusable response', new ApiError('shape', 'Unexpected response')],
    ['a server error (500)', new ApiError('http', 'Server error', 500)],
    ['a gateway error (503)', new ApiError('http', 'Unavailable', 503)],
  ])('is an outage: %s', (_label, error) => {
    expect(isApiOutage(error)).toBe(true)
  })

  it.each([
    ['a 404 for one breed', new ApiError('http', 'Breed not found', 404)],
    ['an http error without a status', new ApiError('http', 'Unknown')],
    ['an error that is not an ApiError', new Error('boom')],
    ['something that is not an error', 'boom'],
  ])('is not an outage: %s', (_label, error) => {
    expect(isApiOutage(error)).toBe(false)
  })
})
