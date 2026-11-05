import { describe, expect, it } from 'vitest'
import { ApiError } from '../src/api/errors'
import { parseBreedList, parseImageResponse } from '../src/api/guards'
import breedsFixture from './fixtures/breeds-list-all.json'

const IMAGE_URL = 'https://images.dog.ceo/breeds/hound-afghan/n02088094_1003.jpg'

describe('parseBreedList', () => {
  it('accepts the real API response and returns the breed record', () => {
    expect(parseBreedList(breedsFixture)).toEqual(breedsFixture.message)
  })

  it('accepts breeds with and without sub-breeds', () => {
    const body = { status: 'success', message: { akita: [], hound: ['afghan', 'basset'] } }
    expect(parseBreedList(body)).toEqual({ akita: [], hound: ['afghan', 'basset'] })
  })

  it.each([
    ['null', null],
    ['a string', 'success'],
    ['an array', []],
    ['a missing status', { message: { akita: [] } }],
    ['a missing message', { status: 'success' }],
    ['a null message', { status: 'success', message: null }],
    ['an array message', { status: 'success', message: ['akita'] }],
    ['a string message', { status: 'success', message: 'akita' }],
    ['a non-array sub-breed value', { status: 'success', message: { hound: 'afghan' } }],
    ['non-string sub-breed items', { status: 'success', message: { hound: ['afghan', 3] } }],
  ])('rejects %s as a shape error', (_label, body) => {
    expect(() => parseBreedList(body)).toThrow(ApiError)
    expect(() => parseBreedList(body)).toThrow(expect.objectContaining({ kind: 'shape' }))
  })

  it('rejects a status "error" body', () => {
    const body = { status: 'error', message: 'Breed not found', code: 404 }
    expect(() => parseBreedList(body)).toThrow(expect.objectContaining({ kind: 'shape' }))
  })
})

describe('parseImageResponse', () => {
  it('accepts a valid image response and returns the URL', () => {
    expect(parseImageResponse({ status: 'success', message: IMAGE_URL })).toBe(IMAGE_URL)
  })

  it.each([
    ['null', null],
    ['a string', IMAGE_URL],
    ['an array', [IMAGE_URL]],
    ['a missing status', { message: IMAGE_URL }],
    ['a missing message', { status: 'success' }],
    ['a number message', { status: 'success', message: 42 }],
    ['an array message', { status: 'success', message: [IMAGE_URL] }],
  ])('rejects %s as a shape error', (_label, body) => {
    expect(() => parseImageResponse(body)).toThrow(ApiError)
    expect(() => parseImageResponse(body)).toThrow(expect.objectContaining({ kind: 'shape' }))
  })

  it('rejects a status "error" body', () => {
    const body = { status: 'error', message: 'Breed not found (main breed does not exist)', code: 404 }
    expect(() => parseImageResponse(body)).toThrow(expect.objectContaining({ kind: 'shape' }))
  })
})
