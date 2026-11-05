/// <reference types="node" />
// Live test: ApiStatus driven by a REAL Dog CEO API call (needs internet).
// An extra delay is added in this test only, so the "Loading…" phase lasts long enough to observe.
// The timeline of what ApiStatus showed is printed to the console (run: npm run test:live).
import { render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { setTimeout as sleep } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { fetchRandomImage } from '../src/api/dogApi'
import { ApiStatus, type ApiCallStatus } from '../src/components/ApiStatus'
import { toLeafId, type Leaf } from '../src/domain/leaf'

const EXTRA_LOADING_MS = 1500
const TIMEOUT_MS = 20_000

const afghan: Leaf = { id: toLeafId('hound', 'afghan'), breed: 'hound', sub: 'afghan' }
const nothing: Leaf = { id: toLeafId('hound', 'nothing'), breed: 'hound', sub: 'nothing' }

/** Shows the status of one real image request, after an extra delay that makes Loading visible. */
function ImageCallStatus({ leaf }: { leaf: Leaf }) {
  const [status, setStatus] = useState<ApiCallStatus>('loading')

  useEffect(() => {
    const controller = new AbortController()
    async function call() {
      try {
        await sleep(EXTRA_LOADING_MS)
        await fetchRandomImage(leaf, controller.signal)
        setStatus('done')
      } catch {
        if (!controller.signal.aborted) setStatus('failed')
      }
    }
    void call()
    return () => controller.abort()
  }, [leaf])

  return <ApiStatus status={status} />
}

/** Records every text the status region shows, with the time it appeared. */
function watchStatus(region: HTMLElement) {
  const started = performance.now()
  const seen: string[] = []
  const record = () => {
    const text = region.textContent ?? ''
    if (text === seen[seen.length - 1]) return
    seen.push(text)
    console.info(`[api status] ${text.padEnd(9)} at ${Math.round(performance.now() - started)} ms`)
  }
  record()
  const observer = new MutationObserver(record)
  observer.observe(region, { childList: true, subtree: true, characterData: true })
  return {
    seen,
    elapsed: () => performance.now() - started,
    stop: () => observer.disconnect(),
  }
}

describe('ApiStatus with a real API call (live)', () => {
  it(
    'shows Loading for a visible while, then Done when the real request succeeds',
    async () => {
      render(<ImageCallStatus leaf={afghan} />)
      const region = screen.getByRole('status')
      expect(region).toHaveTextContent('Loading…')
      const watch = watchStatus(region)

      await waitFor(() => expect(region).toHaveTextContent('Done'), { timeout: TIMEOUT_MS })
      watch.stop()

      expect(watch.seen).toEqual(['Loading…', 'Done'])
      expect(watch.elapsed()).toBeGreaterThanOrEqual(EXTRA_LOADING_MS)
    },
    TIMEOUT_MS,
  )

  it(
    'shows Loading for a visible while, then Failed when the real API answers 404',
    async () => {
      render(<ImageCallStatus leaf={nothing} />)
      const region = screen.getByRole('status')
      expect(region).toHaveTextContent('Loading…')
      const watch = watchStatus(region)

      await waitFor(() => expect(region).toHaveTextContent('Failed'), { timeout: TIMEOUT_MS })
      watch.stop()

      expect(watch.seen).toEqual(['Loading…', 'Failed'])
      expect(watch.elapsed()).toBeGreaterThanOrEqual(EXTRA_LOADING_MS)
    },
    TIMEOUT_MS,
  )
})
