/// <reference types="node" />
import { act, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_OUTAGE_MESSAGE } from '../src/api/errors'
import { Toast } from '../src/components/Toast'
import { toLeafId, type Leaf } from '../src/domain/leaf'
import { useBreedImage } from '../src/features/breeds/useBreedImage'
import { NotificationsProvider } from '../src/state/notifications'

// The image cache lives for the whole session (module level), so each test uses its own leaves.
function leaf(breed: string, sub: string | null): Leaf {
  return { id: toLeafId(breed, sub), breed, sub }
}

function imageResponse(url: string): Response {
  return new Response(JSON.stringify({ status: 'success', message: url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(status: number): Response {
  return new Response(JSON.stringify({ status: 'error', message: 'Breed not found', code: status }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NotificationsProvider>
      <Toast />
      {children}
    </NotificationsProvider>
  )
}

function renderImage(initial: Leaf) {
  return renderHook(({ target }) => useBreedImage(target), {
    wrapper,
    initialProps: { target: initial },
  })
}

describe('useBreedImage: first use (FR-D-2)', () => {
  it('fetches a random image for the leaf and returns its URL', async () => {
    const dog = leaf('hound', 'afghan')
    fetchMock.mockImplementation(async () => imageResponse('https://images.dog.ceo/a.jpg'))

    const { result } = renderImage(dog)

    expect(result.current.status).toBe('loading')
    expect(result.current.url).toBeNull()
    await waitFor(() => expect(result.current.status).toBe('done'))
    expect(result.current.url).toBe('https://images.dog.ceo/a.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://dog.ceo/api/breed/hound/afghan/images/random')
  })

  it('shows the image of the new leaf when the leaf changes', async () => {
    const first = leaf('hound', 'basset')
    const second = leaf('hound', 'blood')
    fetchMock
      .mockImplementationOnce(async () => imageResponse('https://images.dog.ceo/basset.jpg'))
      .mockImplementationOnce(async () => imageResponse('https://images.dog.ceo/blood.jpg'))
    const { result, rerender } = renderImage(first)
    await waitFor(() => expect(result.current.url).toBe('https://images.dog.ceo/basset.jpg'))

    rerender({ target: second })

    expect(result.current.status).toBe('loading')
    expect(result.current.url).toBeNull()
    await waitFor(() => expect(result.current.url).toBe('https://images.dog.ceo/blood.jpg'))
  })
})

describe('useBreedImage: session cache (FR-D-4)', () => {
  it('returns the same URL for the same leaf without another request, straight away', async () => {
    const dog = leaf('terrier', 'norfolk')
    fetchMock
      .mockImplementationOnce(async () => imageResponse('https://images.dog.ceo/first.jpg'))
      .mockImplementation(async () => imageResponse('https://images.dog.ceo/other.jpg'))
    const first = renderImage(dog)
    await waitFor(() => expect(first.result.current.status).toBe('done'))
    first.unmount()

    const second = renderImage(dog)

    expect(second.result.current).toMatchObject({
      status: 'done',
      url: 'https://images.dog.ceo/first.jpg',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('useBreedImage: failure and retry (FR-D-5)', () => {
  it('is failed after an error, and retry fetches again and reaches done', async () => {
    const dog = leaf('retriever', 'golden')
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(async () => imageResponse('https://images.dog.ceo/golden.jpg'))
    const { result } = renderImage(dog)
    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.url).toBeNull()

    act(() => result.current.retry())

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('done'))
    expect(result.current.url).toBe('https://images.dog.ceo/golden.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failure: using the leaf again fetches again', async () => {
    const dog = leaf('retriever', 'flatcoated')
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(async () => imageResponse('https://images.dog.ceo/flat.jpg'))
    const first = renderImage(dog)
    await waitFor(() => expect(first.result.current.status).toBe('failed'))
    first.unmount()

    const second = renderImage(dog)

    expect(second.result.current.status).toBe('loading')
    await waitFor(() => expect(second.result.current.status).toBe('done'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('useBreedImage: retry for an image file that will not load (FR-D-5)', () => {
  it('replaces the cached image with a freshly fetched one', async () => {
    const dog = leaf('terrier', 'cairn')
    fetchMock
      .mockImplementationOnce(async () => imageResponse('https://images.dog.ceo/old.jpg'))
      .mockImplementation(async () => imageResponse('https://images.dog.ceo/new.jpg'))
    const { result } = renderImage(dog)
    await waitFor(() => expect(result.current.url).toBe('https://images.dog.ceo/old.jpg'))

    act(() => result.current.retry())

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.url).toBe('https://images.dog.ceo/new.jpg'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('useBreedImage: outage pop-up (FR-D-9)', () => {
  it('a 404 is failed but raises no pop-up', async () => {
    const dog = leaf('spaniel', 'nothing')
    fetchMock.mockImplementation(async () => errorResponse(404))

    const { result } = renderImage(dog)

    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a network error is failed and raises the red outage pop-up', async () => {
    const dog = leaf('spaniel', 'cocker')
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderImage(dog)

    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(screen.getByRole('alert')).toHaveTextContent(API_OUTAGE_MESSAGE)
  })

  it('a later successful image clears the outage pop-up', async () => {
    const down = leaf('setter', 'irish')
    const up = leaf('setter', 'gordon')
    // The first leaf fails at once; the second answers a little later, so the pop-up shows first.
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/irish/')) throw new TypeError('Failed to fetch')
      await sleep(150)
      return imageResponse('https://images.dog.ceo/gordon.jpg')
    })

    // Both leaves share one NotificationsProvider, as they do in the app.
    const { result } = renderHook(() => ({ a: useBreedImage(down), b: useBreedImage(up) }), { wrapper })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(API_OUTAGE_MESSAGE))
    // result.current is updated in an effect after the DOM commit, so wait for it as well.
    await waitFor(() => expect(result.current.a.status).toBe('failed'))
    await waitFor(() => expect(result.current.b.status).toBe('done'))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
