import { describe, expect, it } from 'vitest'
import { ApiError } from '../src/api/errors'

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
