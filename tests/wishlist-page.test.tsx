/// <reference types="node" />
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setTimeout as sleep } from 'node:timers/promises'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/app/App'
import breedsFixture from './fixtures/breeds-list-all.json'

const KEY = 'dogs-api:v1:collection'

function LocationProbe() {
  const { pathname } = useLocation()
  return <p data-testid="path">{pathname}</p>
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  )
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function respond(input: Parameters<typeof fetch>[0]): Promise<Response> {
  if (String(input).endsWith('/breeds/list/all')) return json(breedsFixture)
  return json({ status: 'success', message: 'https://images.dog.ceo/breeds/test/shot.jpg' })
}

function seed(wishlist: string[], pack: Record<string, number> = {}) {
  localStorage.setItem(KEY, JSON.stringify({ pack, wishlist }))
}

const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockImplementation(respond)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const main = () => screen.getByRole('main')
const rows = () => within(main()).queryAllByRole('listitem')

async function rowsShown() {
  await waitFor(() => expect(rows().length).toBeGreaterThan(0))
}

describe('rows (FR-W-2)', () => {
  it('lists the wishlisted leaves by full name, in the order they were added', async () => {
    seed(['spaniel/welsh', 'akita', 'hound/afghan'])
    renderAt('/wishlist')

    await waitFor(() => expect(rows()).toHaveLength(3))

    expect(rows()[0]).toHaveTextContent(/^Welsh Spaniel/)
    expect(rows()[1]).toHaveTextContent(/^Akita/)
    expect(rows()[2]).toHaveTextContent(/^Afghan Hound/)
    expect(within(main()).getByRole('heading', { level: 1, name: 'Wishlist' })).toBeInTheDocument()
  })

  it('shows the breed tag on sub-breed rows only', async () => {
    seed(['akita', 'hound/afghan'])
    renderAt('/wishlist')

    await waitFor(() => expect(rows()).toHaveLength(2))

    const [akita, afghan] = rows() as [HTMLElement, HTMLElement]
    expect(within(afghan).getByText('Hound')).toBeInTheDocument()
    expect(within(akita).queryByText('Hound')).not.toBeInTheDocument()
    expect(within(main()).getAllByText('Hound')).toHaveLength(1)
  })
})

describe('removing (FR-W-2)', () => {
  it('deletes the entry and saves the change', async () => {
    const user = userEvent.setup()
    seed(['hound/afghan', 'akita'])
    renderAt('/wishlist')
    await waitFor(() => expect(rows()).toHaveLength(2))

    await user.click(within(main()).getByRole('button', { name: 'Remove Afghan Hound from wishlist' }))

    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent(/^Akita/)
    expect(stored()).toEqual({ pack: {}, wishlist: ['akita'] })
  })

  it('shows the empty state after the last entry is removed', async () => {
    const user = userEvent.setup()
    seed(['akita'])
    renderAt('/wishlist')
    await rowsShown()

    await user.click(within(main()).getByRole('button', { name: 'Remove Akita from wishlist' }))

    expect(rows()).toHaveLength(0)
    expect(within(main()).getByText('Your wishlist is empty.')).toBeInTheDocument()
  })
})

describe('the empty state (FR-W-3)', () => {
  it('says the wishlist is empty and links to the Breeds page', async () => {
    const user = userEvent.setup()
    renderAt('/wishlist')

    expect(within(main()).getByText('Your wishlist is empty.')).toBeInTheDocument()
    const link = within(main()).getByRole('link', { name: 'Browse breeds' })
    expect(link).toHaveAttribute('href', '/breeds')

    await user.click(link)

    expect(screen.getByTestId('path')).toHaveTextContent(/^\/breeds$/)
    expect(within(main()).getByRole('heading', { level: 1, name: 'Breeds' })).toBeInTheDocument()
  })

  it('does not depend on the breed list loading', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderAt('/wishlist')

    expect(within(main()).getByText('Your wishlist is empty.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(within(main()).getByText('Your wishlist is empty.')).toBeInTheDocument()
  })
})

describe('a breed the API no longer lists (FR-U-3)', () => {
  it('shows "No longer available", makes no image request, and Remove deletes it', async () => {
    const user = userEvent.setup()
    seed(['hound/retired', 'akita'])
    renderAt('/wishlist')
    await waitFor(() => expect(rows()).toHaveLength(2))

    const retired = rows().find((row) => row.textContent?.includes('hound/retired')) as HTMLElement
    expect(within(retired).getByText('No longer available')).toBeInTheDocument()
    const imageRequests = fetchMock.mock.calls.filter(([input]) => String(input).includes('/images/random'))
    expect(imageRequests).toHaveLength(0)

    await user.click(within(retired).getByRole('button', { name: 'Remove hound/retired from wishlist' }))

    expect(rows()).toHaveLength(1)
    expect(stored()).toEqual({ pack: {}, wishlist: ['akita'] })
  })
})

describe('while the breed list loads or fails', () => {
  it('shows Loading until the names are known', async () => {
    fetchMock.mockImplementation(async (input) => {
      await sleep(150)
      return respond(input)
    })
    seed(['hound/afghan'])
    renderAt('/wishlist')

    expect(within(main()).getByRole('status')).toHaveTextContent('Loading…')
    expect(rows()).toHaveLength(0)

    await rowsShown()
    expect(within(main()).queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows Failed and Retry, and Retry brings the rows', async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    seed(['hound/afghan'])
    renderAt('/wishlist')

    await waitFor(() => expect(within(main()).getByRole('status')).toHaveTextContent('Failed'))

    await user.click(within(main()).getByRole('button', { name: 'Retry' }))

    await rowsShown()
    expect(within(main()).getByText('Afghan Hound')).toBeInTheDocument()
  })
})

describe('independent of the Pack (acceptance 4)', () => {
  it('a leaf can be on both pages; removing it from one leaves the other alone', async () => {
    const user = userEvent.setup()
    seed(['hound/afghan'], { 'hound/afghan': 2 })
    renderAt('/wishlist')
    await rowsShown()

    await user.click(within(main()).getByRole('button', { name: 'Remove Afghan Hound from wishlist' }))
    expect(stored()).toEqual({ pack: { 'hound/afghan': 2 }, wishlist: [] })

    await user.click(screen.getByRole('link', { name: 'My Pack' }))
    await rowsShown()
    expect(within(main()).getByText('× 2')).toBeInTheDocument()
  })
})

describe('from the Breeds page to the Wishlist', () => {
  it('a leaf added once shows as one row, and adding it again does not duplicate it', async () => {
    const user = userEvent.setup()
    renderAt('/breeds/spaniel/welsh')
    await screen.findByRole('button', { name: 'Add to Wishlist' })

    await user.click(screen.getByRole('button', { name: 'Add to Wishlist' }))
    await user.click(screen.getByRole('button', { name: 'On wishlist' }))
    await user.click(screen.getByRole('link', { name: 'Wishlist' }))

    await rowsShown()
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent(/^Welsh Spaniel/)
  })
})
