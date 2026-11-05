import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/app/App'
import { API_OUTAGE_MESSAGE } from '../src/api/errors'
import breedsFixture from './fixtures/breeds-list-all.json'

// Marks every tag so the 99 tagged rows can be counted.
vi.mock('../src/components/Tag', async () => {
  const { createElement } = await import('react')
  return {
    Tag: ({ children }: { children: ReactNode }) => createElement('span', { 'data-testid': 'tag' }, children),
  }
})

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <p data-testid="url">{pathname + search}</p>
}

function BackButton() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>browser back</button>
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <App />
      <LocationProbe />
      <BackButton />
    </MemoryRouter>,
  )
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** The list for /breeds/list/all, and a picture for any image request. */
async function respond(input: Parameters<typeof fetch>[0]): Promise<Response> {
  if (String(input).endsWith('/breeds/list/all')) return json(breedsFixture)
  return json({ status: 'success', message: 'https://images.dog.ceo/breeds/test/shot.jpg' })
}

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
const rows = () => within(main()).getAllByRole('listitem')
const row = (name: RegExp) => within(main()).getByRole('link', { name })

async function listLoaded() {
  await waitFor(() => expect(within(main()).getAllByRole('listitem').length).toBeGreaterThan(0))
}

describe('the list (FR-M-1, FR-M-2, FR-M-4)', () => {
  it('shows Loading, then 165 rows: 99 with a breed tag and 66 without', async () => {
    renderAt('/breeds')
    expect(within(main()).getByRole('status')).toHaveTextContent('Loading…')

    await listLoaded()

    expect(rows()).toHaveLength(165)
    expect(within(main()).getAllByTestId('tag')).toHaveLength(99)
    expect(within(main()).getByRole('heading', { level: 1, name: 'Breeds' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows Failed, a Retry button and the outage pop-up when the list cannot load', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderAt('/breeds')

    await waitFor(() => expect(within(main()).getByRole('status')).toHaveTextContent('Failed'))
    expect(within(main()).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(API_OUTAGE_MESSAGE)
    expect(within(main()).queryAllByRole('listitem')).toHaveLength(0)
  })

  it('Retry loads the list and clears the pop-up', async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderAt('/breeds')
    await waitFor(() => expect(within(main()).getByRole('button', { name: 'Retry' })).toBeInTheDocument())

    await user.click(within(main()).getByRole('button', { name: 'Retry' }))

    await listLoaded()
    expect(rows()).toHaveLength(165)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('has a link on every row to its own page, with no query string and nothing that expands', async () => {
    renderAt('/breeds?q=ha&sort=desc')
    await listLoaded()

    const links = within(main()).getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      const href = link.getAttribute('href') ?? ''
      expect(href).toMatch(/^\/breeds\/[a-z-]+(\/[a-z-]+)?$/)
    }
    expect(within(main()).queryAllByRole('button', { expanded: true })).toHaveLength(0)
    expect(main().querySelectorAll('[aria-expanded]')).toHaveLength(0)
  })

  it('goes from the filtered, sorted list to the plain item URL, and Back restores the list', async () => {
    const user = userEvent.setup()
    renderAt('/breeds?q=ha&sort=desc')
    await listLoaded()
    const before = rows().length
    const first = within(main()).getAllByRole('link')[0] as HTMLElement
    const href = first.getAttribute('href')

    await user.click(first)

    // The item URL is the plain path: the filter and the order are not carried along.
    expect(screen.getByTestId('url').textContent).toBe(href)
    await waitFor(() => expect(within(main()).queryByRole('list')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'browser back' }))

    expect(screen.getByTestId('url').textContent).toBe('/breeds?q=ha&sort=desc')
    await listLoaded()
    expect(rows()).toHaveLength(before)
  })

  it('is only the list: opening /breeds shows no item page and requests no image', async () => {
    renderAt('/breeds')
    await listLoaded()

    expect(within(main()).queryByRole('region')).not.toBeInTheDocument()
    const imageRequests = fetchMock.mock.calls.filter(([input]) => String(input).includes('/images/random'))
    expect(imageRequests).toHaveLength(0)
  })
})

describe('the Wishlist marker (FR-W-4)', () => {
  it('marks the rows of leaves that are on the wishlist', async () => {
    localStorage.setItem(
      'dogs-api:v1:collection',
      JSON.stringify({ pack: {}, wishlist: ['akita', 'hound/afghan'] }),
    )
    renderAt('/breeds')
    await listLoaded()

    expect(within(main()).getAllByText('On wishlist')).toHaveLength(2)
    expect(row(/^Akita\s*On wishlist/)).toBeInTheDocument()
  })
})
