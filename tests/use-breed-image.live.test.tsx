// Live test: useBreedImage with REAL Dog CEO API calls (needs internet).
// fetch is wrapped in a spy that passes every call through; it only counts them.
import { renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { Toast } from '../src/components/Toast'
import { toLeafId, type Leaf } from '../src/domain/leaf'
import { useBreedImage } from '../src/features/breeds/useBreedImage'
import { NotificationsProvider } from '../src/state/notifications'

const TIMEOUT_MS = 20_000

// The image cache lives for the whole session, so each test uses its own leaves.
function leaf(breed: string, sub: string | null): Leaf {
  return { id: toLeafId(breed, sub), breed, sub }
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NotificationsProvider>
      <Toast />
      {children}
    </NotificationsProvider>
  )
}

let fetchSpy: MockInstance<typeof fetch>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})

afterEach(() => {
  fetchSpy.mockRestore()
})

function imageRequests(): number {
  return fetchSpy.mock.calls.filter(([url]) => String(url).includes('/images/random')).length
}

describe('useBreedImage with the real API (live)', () => {
  it(
    'goes from loading to done with a real image of the sub-breed, and the image loads',
    async () => {
      const afghan = leaf('hound', 'afghan')

      const { result } = renderHook(() => useBreedImage(afghan), { wrapper })

      expect(result.current.status).toBe('loading')
      await waitFor(() => expect(result.current.status).toBe('done'), { timeout: TIMEOUT_MS })
      const url = result.current.url ?? ''
      expect(url).toMatch(/^https:\/\/images\.dog\.ceo\/breeds\/hound-afghan\/.+\.(jpe?g|png)$/i)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()

      const image = await fetch(url, { method: 'HEAD' })
      expect(image.ok).toBe(true)
      expect(image.headers.get('content-type')).toMatch(/^image\//)
    },
    TIMEOUT_MS,
  )

  it(
    'gives a breed without sub-breeds an image of that breed',
    async () => {
      const akita = leaf('akita', null)

      const { result } = renderHook(() => useBreedImage(akita), { wrapper })

      await waitFor(() => expect(result.current.status).toBe('done'), { timeout: TIMEOUT_MS })
      expect(result.current.url).toMatch(/^https:\/\/images\.dog\.ceo\/breeds\/akita\/.+\.(jpe?g|png)$/i)
    },
    TIMEOUT_MS,
  )

  it(
    'returns the same image on a second use straight away, with no second request',
    async () => {
      const basset = leaf('hound', 'basset')
      const first = renderHook(() => useBreedImage(basset), { wrapper })
      await waitFor(() => expect(first.result.current.status).toBe('done'), { timeout: TIMEOUT_MS })
      const firstUrl = first.result.current.url
      expect(imageRequests()).toBe(1)
      first.unmount()

      const second = renderHook(() => useBreedImage(basset), { wrapper })

      expect(second.result.current).toMatchObject({ status: 'done', url: firstUrl })
      expect(imageRequests()).toBe(1)
    },
    TIMEOUT_MS,
  )

  it(
    'is failed for an unknown sub-breed (real 404), without the outage pop-up, and retry fetches again',
    async () => {
      const nothing = leaf('hound', 'nothing')

      const { result } = renderHook(() => useBreedImage(nothing), { wrapper })

      await waitFor(() => expect(result.current.status).toBe('failed'), { timeout: TIMEOUT_MS })
      expect(result.current.url).toBeNull()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(imageRequests()).toBe(1)

      result.current.retry()

      await waitFor(() => expect(imageRequests()).toBe(2), { timeout: TIMEOUT_MS })
      await waitFor(() => expect(result.current.status).toBe('failed'), { timeout: TIMEOUT_MS })
    },
    TIMEOUT_MS,
  )
})
