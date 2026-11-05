/// <reference types="node" />
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setTimeout as sleep } from 'node:timers/promises'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/app/App'
import breedsFixture from './fixtures/breeds-list-all.json'

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let imageCalls = 0

/** The list for /breeds/list/all; a different picture for every image request. */
async function respond(input: Parameters<typeof fetch>[0]): Promise<Response> {
  if (String(input).endsWith('/breeds/list/all')) return json(breedsFixture)
  imageCalls += 1
  return json({ status: 'success', message: `https://images.dog.ceo/breeds/test/shot-${imageCalls}.jpg` })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  localStorage.clear()
  imageCalls = 0
  fetchMock.mockImplementation(respond)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const main = () => screen.getByRole('main')
const url = () => screen.getByTestId('url')
const imageRequests = () => fetchMock.mock.calls.filter(([input]) => String(input).includes('/images/random'))

// The image cache lasts for the whole session, so each test that needs a fresh fetch uses its own leaf.

describe('an item page (FR-D-1a, FR-D-2, FR-D-3)', () => {
  it('shows the name as the h1, the breed tag, the image and both actions, and not the list', async () => {
    renderAt('/breeds/hound/afghan')

    expect(await screen.findByRole('heading', { level: 1, name: 'Afghan Hound' })).toBeInTheDocument()
    expect(within(main()).getByText('Hound')).toBeInTheDocument()
    expect(await within(main()).findByRole('img')).toHaveAttribute('src', expect.stringContaining('shot-'))
    expect(within(main()).getByRole('button', { name: 'Add to Pack' })).toBeInTheDocument()
    expect(within(main()).getByRole('button', { name: 'Add to Wishlist' })).toBeInTheDocument()
    expect(within(main()).queryByRole('list')).not.toBeInTheDocument()
    expect(url()).toHaveTextContent(/^\/breeds\/hound\/afghan$/)
  })

  it('shows a breed without sub-breeds with no tag', async () => {
    renderAt('/breeds/akita')

    expect(await screen.findByRole('heading', { level: 1, name: 'Akita' })).toBeInTheDocument()
    expect(await within(main()).findByRole('img')).toBeInTheDocument()
    expect(within(main()).queryByText('Akita', { selector: 'span' })).not.toBeInTheDocument()
    expect(within(main()).getAllByRole('heading')).toHaveLength(1)
  })

  it('has a single h1 and no other heading, so the name is the page heading', async () => {
    renderAt('/breeds/spaniel/cocker')

    await screen.findByRole('heading', { level: 1, name: 'Cocker Spaniel' })

    expect(within(main()).getAllByRole('heading')).toHaveLength(1)
  })
})

describe('while the breed list loads or fails (FR-D-11)', () => {
  it('shows Loading until the element can be named', async () => {
    fetchMock.mockImplementation(async (input) => {
      await sleep(150)
      return respond(input)
    })
    renderAt('/breeds/hound/basset')

    expect(within(main()).getByRole('status')).toHaveTextContent('Loading…')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()

    expect(await screen.findByRole('heading', { level: 1, name: 'Basset Hound' })).toBeInTheDocument()
  })

  it('shows Failed with a Retry button when the list cannot load, and Retry brings the page', async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderAt('/breeds/hound/blood')

    await waitFor(() => expect(within(main()).getByRole('status')).toHaveTextContent('Failed'))
    expect(within(main()).getByText("Couldn't load the list of breeds.")).toBeInTheDocument()

    await user.click(within(main()).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Blood Hound' })).toBeInTheDocument()
  })
})

describe('an element that does not exist (FR-D-1b)', () => {
  it.each(['/breeds/hound/nothing', '/breeds/hound', '/breeds/nosuchbreed'])(
    '%s shows the static 404 page and nothing else',
    async (path) => {
      renderAt(path)

      expect(await screen.findByRole('heading', { level: 1, name: '404' })).toBeInTheDocument()
      expect(screen.getByText('Page not found.')).toBeInTheDocument()
      expect(url()).toHaveTextContent(path)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(within(main()).queryByRole('list')).not.toBeInTheDocument()
      expect(within(main()).queryByRole('img')).not.toBeInTheDocument()
      expect(within(main()).queryByRole('button')).not.toBeInTheDocument()
      expect(imageRequests()).toHaveLength(0)
    },
  )
})

describe('opening the same page again (FR-D-4)', () => {
  it('shows the same image and fetches it only once', async () => {
    const user = userEvent.setup()
    renderAt('/breeds/spaniel/welsh')
    const first = (await within(main()).findByRole('img')).getAttribute('src')
    expect(imageRequests()).toHaveLength(1)

    await user.click(screen.getByRole('link', { name: 'Wishlist' }))
    expect(within(main()).getByRole('heading', { level: 1, name: 'Wishlist' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'browser back' }))

    expect(await within(main()).findByRole('heading', { level: 1, name: 'Welsh Spaniel' })).toBeInTheDocument()
    expect((await within(main()).findByRole('img')).getAttribute('src')).toBe(first)
    expect(imageRequests()).toHaveLength(1)
  })
})

describe('the actions on the page', () => {
  it('Add to Pack twice shows the count, and Add to Wishlist flips to "On wishlist" without duplicating', async () => {
    const user = userEvent.setup()
    renderAt('/breeds/spaniel/sussex')
    await within(main()).findByRole('img')

    await user.click(screen.getByRole('button', { name: 'Add to Pack' }))
    await user.click(screen.getByRole('button', { name: 'Add to Pack' }))
    await user.click(screen.getByRole('button', { name: 'Add to Wishlist' }))
    await user.click(screen.getByRole('button', { name: 'On wishlist' }))

    expect(screen.getByText('In your pack: 2')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('dogs-api:v1:collection') ?? 'null')).toEqual({
      pack: { 'spaniel/sussex': 2 },
      wishlist: ['spaniel/sussex'],
    })
  })
})

describe('the sidebar (FR-NAV-1)', () => {
  it('keeps Breeds marked on an item page, and has no link to an item page', async () => {
    renderAt('/breeds/spaniel/japanese')
    await screen.findByRole('heading', { level: 1, name: 'Japanese Spaniel' })

    const nav = screen.getByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/breeds', '/pack', '/wishlist'])
    expect(within(nav).getByRole('link', { name: 'Breeds' })).toHaveAttribute('aria-current', 'page')
  })
})
