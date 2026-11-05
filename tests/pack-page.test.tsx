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

function seed(pack: Record<string, number>, wishlist: string[] = []) {
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
const rowText = () => rows().map((row) => row.textContent ?? '')

async function rowsShown() {
  await waitFor(() => expect(rows().length).toBeGreaterThan(0))
}

describe('rows (FR-P-2)', () => {
  it('shows a leaf added three times as one row with a count of 3', async () => {
    seed({ 'hound/afghan': 3 })
    renderAt('/pack')

    await rowsShown()

    expect(rows()).toHaveLength(1)
    expect(within(rows()[0] as HTMLElement).getByText('Afghan Hound')).toBeInTheDocument()
    expect(within(rows()[0] as HTMLElement).getByText('× 3')).toBeInTheDocument()
    expect(within(main()).getByRole('heading', { level: 1, name: 'My Pack' })).toBeInTheDocument()
  })

  it('shows the breed tag on a sub-breed row only', async () => {
    seed({ akita: 1, 'hound/afghan': 1 })
    renderAt('/pack')

    await waitFor(() => expect(rows()).toHaveLength(2))

    const [akita, afghan] = rows() as [HTMLElement, HTMLElement]
    expect(akita).toHaveTextContent(/^Akita\s*× 1/)
    expect(within(afghan).getByText('Hound')).toBeInTheDocument()
    expect(within(akita).queryByText('Hound')).not.toBeInTheDocument()
  })

  it('lists the rows in breed order', async () => {
    seed({ 'spaniel/welsh': 1, 'hound/afghan': 2, akita: 1 })
    renderAt('/pack')

    await waitFor(() => expect(rows()).toHaveLength(3))

    expect(rowText()[0]).toMatch(/^Akita/)
    expect(rowText()[1]).toMatch(/^Afghan Hound/)
    expect(rowText()[2]).toMatch(/^Welsh Spaniel/)
  })
})

describe('removing (FR-P-3)', () => {
  it('lowers the count by one, and the row goes when the count reaches zero', async () => {
    const user = userEvent.setup()
    seed({ 'hound/afghan': 2 })
    renderAt('/pack')
    await rowsShown()

    await user.click(within(main()).getByRole('button', { name: 'Remove one Afghan Hound' }))
    expect(within(main()).getByText('× 1')).toBeInTheDocument()
    expect(stored()).toEqual({ pack: { 'hound/afghan': 1 }, wishlist: [] })

    await user.click(within(main()).getByRole('button', { name: 'Remove one Afghan Hound' }))
    expect(rows()).toHaveLength(0)
    expect(stored()).toEqual({ pack: {}, wishlist: [] })
    expect(within(main()).getByText('Your pack is empty.')).toBeInTheDocument()
  })

  it('removes from the pack without touching the wishlist', async () => {
    const user = userEvent.setup()
    seed({ 'hound/afghan': 1 }, ['hound/afghan'])
    renderAt('/pack')
    await rowsShown()

    await user.click(within(main()).getByRole('button', { name: 'Remove one Afghan Hound' }))

    expect(stored()).toEqual({ pack: {}, wishlist: ['hound/afghan'] })
  })
})

describe('the empty state (FR-P-4)', () => {
  it('says the pack is empty and links to the Breeds page', async () => {
    const user = userEvent.setup()
    renderAt('/pack')

    expect(within(main()).getByText('Your pack is empty.')).toBeInTheDocument()
    const link = within(main()).getByRole('link', { name: 'Browse breeds' })
    expect(link).toHaveAttribute('href', '/breeds')

    await user.click(link)

    expect(screen.getByTestId('path')).toHaveTextContent(/^\/breeds$/)
    expect(within(main()).getByRole('heading', { level: 1, name: 'Breeds' })).toBeInTheDocument()
  })

  it('does not wait for the breed list, nor fail when it cannot load', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderAt('/pack')

    expect(within(main()).getByText('Your pack is empty.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(within(main()).getByText('Your pack is empty.')).toBeInTheDocument()
  })
})

describe('a breed the API no longer lists (FR-U-3)', () => {
  it('shows "No longer available" and its count, makes no image request, and Remove deletes it', async () => {
    const user = userEvent.setup()
    seed({ 'hound/retired': 2, akita: 1 })
    renderAt('/pack')
    await waitFor(() => expect(rows()).toHaveLength(2))

    const retired = rows().find((row) => row.textContent?.includes('hound/retired')) as HTMLElement
    expect(within(retired).getByText('No longer available')).toBeInTheDocument()
    expect(within(retired).getByText('× 2')).toBeInTheDocument()
    const imageRequests = fetchMock.mock.calls.filter(([input]) => String(input).includes('/images/random'))
    expect(imageRequests).toHaveLength(0)

    await user.click(within(retired).getByRole('button', { name: 'Remove hound/retired' }))

    expect(rows()).toHaveLength(1)
    expect(stored()).toEqual({ pack: { akita: 1 }, wishlist: [] })
  })
})

describe('while the breed list loads or fails', () => {
  it('shows Loading until the names are known', async () => {
    fetchMock.mockImplementation(async (input) => {
      await sleep(150)
      return respond(input)
    })
    seed({ 'hound/afghan': 1 })
    renderAt('/pack')

    expect(within(main()).getByRole('status')).toHaveTextContent('Loading…')
    expect(rows()).toHaveLength(0)

    await rowsShown()
    expect(within(main()).queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows Failed and a Retry button, and Retry brings the rows', async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    seed({ 'hound/afghan': 1 })
    renderAt('/pack')

    await waitFor(() => expect(within(main()).getByRole('status')).toHaveTextContent('Failed'))
    expect(rows()).toHaveLength(0)

    await user.click(within(main()).getByRole('button', { name: 'Retry' }))

    await rowsShown()
    expect(within(main()).getByText('Afghan Hound')).toBeInTheDocument()
  })
})

describe('from the Breeds page to the Pack (acceptance 4)', () => {
  it('adding the same sub-breed three times gives one row with a count of 3', async () => {
    const user = userEvent.setup()
    renderAt('/breeds/spaniel/welsh')
    await screen.findByRole('button', { name: 'Add to Pack' })

    await user.click(screen.getByRole('button', { name: 'Add to Pack' }))
    await user.click(screen.getByRole('button', { name: 'Add to Pack' }))
    await user.click(screen.getByRole('button', { name: 'Add to Pack' }))
    await user.click(screen.getByRole('link', { name: 'My Pack' }))

    await rowsShown()
    expect(rows()).toHaveLength(1)
    expect(within(main()).getByText('Welsh Spaniel')).toBeInTheDocument()
    expect(within(main()).getByText('× 3')).toBeInTheDocument()
  })
})
