/// <reference types="node" />
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_OUTAGE_MESSAGE } from '../src/api/errors'
import { Toast } from '../src/components/Toast'
import { toLeafId } from '../src/domain/leaf'
import { BreedsProvider, useBreeds } from '../src/features/breeds/BreedsProvider'
import { NotificationsProvider } from '../src/state/notifications'
import breedsFixture from './fixtures/breeds-list-all.json'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
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

function Probe() {
  const { status, leaves, index, retry } = useBreeds()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="count">{leaves.length}</p>
      <p data-testid="has-afghan">{String(index.has(toLeafId('hound', 'afghan')))}</p>
      <button onClick={retry}>retry</button>
    </div>
  )
}

function App() {
  return (
    <NotificationsProvider>
      <Toast />
      <BreedsProvider>
        <Probe />
      </BreedsProvider>
    </NotificationsProvider>
  )
}

const status = () => screen.getByTestId('status')

describe('BreedsProvider loading (FR-M-4)', () => {
  it('starts loading, then is done with all 165 leaves and an index', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(breedsFixture))
    render(<App />)

    expect(status()).toHaveTextContent('loading')
    expect(screen.getByTestId('count')).toHaveTextContent('0')

    await waitFor(() => expect(status()).toHaveTextContent('done'))
    expect(screen.getByTestId('count')).toHaveTextContent('165')
    expect(screen.getByTestId('has-afghan')).toHaveTextContent('true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('under StrictMode, the aborted first request causes no error and no pop-up', async () => {
    // A fetch that honours its abort signal, like the real one: an aborted request rejects.
    fetchMock.mockImplementation(async (_url, init) => {
      await sleep(30, undefined, { signal: init?.signal ?? undefined })
      return jsonResponse(breedsFixture)
    })
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    await waitFor(() => expect(status()).toHaveTextContent('done'))
    expect(screen.getByTestId('count')).toHaveTextContent('165')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    expect(fetchMock.mock.calls.at(-1)?.[1]?.signal?.aborted).toBe(false)
  })

  it('aborts the request when it unmounts', async () => {
    fetchMock.mockImplementation(async () => {
      await sleep(300)
      return jsonResponse(breedsFixture)
    })
    const { unmount } = render(<App />)
    const signal = fetchMock.mock.calls[0]?.[1]?.signal

    expect(signal?.aborted).toBe(false)

    unmount()

    expect(signal?.aborted).toBe(true)
  })
})

describe('BreedsProvider failure and retry', () => {
  it('is failed after a network error and raises the red outage pop-up', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<App />)

    await waitFor(() => expect(status()).toHaveTextContent('failed'))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(screen.getByRole('alert')).toHaveTextContent(API_OUTAGE_MESSAGE)
  })

  it('raises the pop-up for a server error as well', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ status: 'error' }, 503))
    render(<App />)

    await waitFor(() => expect(status()).toHaveTextContent('failed'))
    expect(screen.getByRole('alert')).toHaveTextContent(API_OUTAGE_MESSAGE)
  })

  it('retry after a failure loads the list and clears the pop-up', async () => {
    const user = userEvent.setup()
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(async () => jsonResponse(breedsFixture))
    render(<App />)
    await waitFor(() => expect(status()).toHaveTextContent('failed'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'retry' }))

    await waitFor(() => expect(status()).toHaveTextContent('done'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('count')).toHaveTextContent('165')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('useBreeds', () => {
  it('throws a clear error outside a BreedsProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow(/BreedsProvider/)

    vi.restoreAllMocks()
  })
})
