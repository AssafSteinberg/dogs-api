import { useCallback, useEffect, useState } from 'react'
import { fetchRandomImage } from '../../api/dogApi'
import { API_OUTAGE_MESSAGE, isApiOutage } from '../../api/errors'
import type { ApiCallStatus } from '../../components/ApiStatus'
import type { Leaf, LeafId } from '../../domain/leaf'
import { useNotify } from '../../state/notifications'

export interface BreedImageState {
  status: ApiCallStatus
  /** The image URL once the status is "done", otherwise null. */
  url: string | null
  /** Fetches again; meant for the Failed state. */
  retry: () => void
}

// Resolved image URLs for the whole session (FR-D-4): the first expand of a leaf fetches,
// later expands reuse the same image. Memory only; a page reload gives a new random image
// and no image data is ever stored (FR-U-2). Failures are never put here.
const imageCache = new Map<LeafId, string>()

/** What the last request for a leaf ended with; a null url means it failed. */
interface Settled {
  id: LeafId
  url: string | null
}

/** One random image for a leaf, fetched when first needed (architecture 6.3). */
export function useBreedImage(leaf: Leaf): BreedImageState {
  const { notify, clear } = useNotify()
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)

  useEffect(() => {
    if (imageCache.has(leaf.id)) return

    // Cleanup aborts this run's request; an aborted request is ignored, never an error
    // (React StrictMode runs the effect twice in development).
    const controller = new AbortController()

    async function load() {
      try {
        const url = await fetchRandomImage(leaf, controller.signal)
        if (controller.signal.aborted) return
        imageCache.set(leaf.id, url)
        setSettled({ id: leaf.id, url })
        clear('api')
      } catch (error) {
        if (controller.signal.aborted) return
        setSettled({ id: leaf.id, url: null })
        // A 404 for one breed is not an outage; only an unreachable or broken API gets the pop-up.
        if (isApiOutage(error)) notify(API_OUTAGE_MESSAGE, 'api')
      }
    }
    void load()

    return () => controller.abort()
  }, [leaf, attempt, notify, clear])

  const retry = useCallback(() => {
    setSettled(null)
    setAttempt((value) => value + 1)
  }, [])

  const cached = imageCache.get(leaf.id)
  if (cached !== undefined) return { status: 'done', url: cached, retry }
  if (settled !== null && settled.id === leaf.id && settled.url === null) {
    return { status: 'failed', url: null, retry }
  }
  return { status: 'loading', url: null, retry }
}
