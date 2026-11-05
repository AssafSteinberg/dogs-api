import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../src/api/errors'
import { fetchBreedList, fetchRandomImage } from '../src/api/dogApi'
import { toLeafId } from '../src/domain/leaf'
import breedsFixture from './fixtures/breeds-list-all.json'

const BASE = 'https://dog.ceo/api'
const IMAGE_URL = 'https://images.dog.ceo/breeds/hound-afghan/n02088094_1003.jpg'

const afghan = { id: toLeafId('hound', 'afghan'), breed: 'hound', sub: 'afghan' }
const akita = { id: toLeafId('akita', null), breed: 'akita', sub: null }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected the promise to reject')
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('fetchBreedList', () => {
  it('requests /breeds/list/all and returns the parsed record', async () => {
    fetchMock.mockResolvedValue(jsonResponse(breedsFixture))

    const record = await fetchBreedList()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/breeds/list/all`)
    expect(record).toEqual(breedsFixture.message)
  })

  it('passes the abort signal to fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse(breedsFixture))
    const controller = new AbortController()

    await fetchBreedList(controller.signal)

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })
})

describe('fetchRandomImage', () => {
  it('uses the sub-breed endpoint for a sub-breed leaf', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'success', message: IMAGE_URL }))

    const url = await fetchRandomImage(afghan)

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/breed/hound/afghan/images/random`)
    expect(url).toBe(IMAGE_URL)
  })

  it('uses the breed endpoint for a breed without sub-breeds', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'success', message: IMAGE_URL }))

    await fetchRandomImage(akita)

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/breed/akita/images/random`)
  })

  it('never calls the breed-level endpoint for a sub-breed', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'success', message: IMAGE_URL }))

    await fetchRandomImage(afghan)

    expect(fetchMock.mock.calls[0]?.[0]).not.toBe(`${BASE}/breed/hound/images/random`)
  })
})

describe('failures', () => {
  it('turns a rejected fetch into a network ApiError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchBreedList()).rejects.toBeInstanceOf(ApiError)
    await expect(fetchBreedList()).rejects.toMatchObject({ kind: 'network' })
    await expect(fetchRandomImage(afghan)).rejects.toMatchObject({ kind: 'network' })
  })

  it.each([404, 500])('turns HTTP %i into an http ApiError carrying the status', async (status) => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'error', message: 'Breed not found', code: status }, status),
    )

    await expect(fetchRandomImage(afghan)).rejects.toMatchObject({ kind: 'http', status })
    await expect(fetchBreedList()).rejects.toMatchObject({ kind: 'http', status })
  })

  it('turns an unexpected 200 body into a shape ApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'success', message: 42 }))

    await expect(fetchRandomImage(afghan)).rejects.toMatchObject({ kind: 'shape' })
  })

  it('turns a body that is not JSON into a shape ApiError', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 200 }))

    await expect(fetchBreedList()).rejects.toMatchObject({ kind: 'shape' })
  })
})

describe('aborting', () => {
  it('rethrows an abort as-is, so it can be told apart from a failure', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError')
    fetchMock.mockRejectedValue(abort)

    const error = await rejectionOf(fetchBreedList())

    expect(error).toBe(abort)
    expect(error).not.toBeInstanceOf(ApiError)
  })

  it('does not report an aborted image request as a network failure', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))

    const error = await rejectionOf(fetchRandomImage(akita))

    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ name: 'AbortError' })
  })
})
