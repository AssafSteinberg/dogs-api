import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/app/App'
import { API_OUTAGE_MESSAGE } from '../src/api/errors'
import breedsFixture from './fixtures/breeds-list-all.json'

// Counts renders of Tag (rendered by every sub-breed row), and marks each tag for counting.
const tagRenders = vi.hoisted(() => ({ count: 0 }))
vi.mock('../src/components/Tag', async () => {
  const { createElement } = await import('react')
  return {
    Tag: ({ children }: { children: ReactNode }) => {
      tagRenders.count += 1
      return createElement('span', { 'data-testid': 'tag' }, children)
    },
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

function listResponse(): Response {
  return new Response(JSON.stringify(breedsFixture), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockImplementation(async () => listResponse())
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const main = () => screen.getByRole('main')
const url = () => screen.getByTestId('url')
const rows = () => within(main()).getAllByRole('listitem')
const row = (name: RegExp) => within(main()).getByRole('button', { name })
const expandedButtons = () => within(main()).queryAllByRole('button', { expanded: true })

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
    expect(expandedButtons()).toHaveLength(0)
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
})

describe('expanding changes the URL (FR-D-1, FR-D-1a)', () => {
  it('expands a sub-breed to /breeds/hound/afghan and collapses back to /breeds', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()

    await user.click(row(/^Afghan\s*Hound/))
    expect(url()).toHaveTextContent('/breeds/hound/afghan')
    expect(row(/^Afghan\s*Hound/)).toHaveAttribute('aria-expanded', 'true')
    expect(expandedButtons()).toHaveLength(1)

    await user.click(row(/^Afghan\s*Hound/))
    expect(url()).toHaveTextContent(/^\/breeds$/)
    expect(expandedButtons()).toHaveLength(0)
  })

  it('expands a breed without sub-breeds to /breeds/akita', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()

    await user.click(row(/^Akita$/))

    expect(url()).toHaveTextContent('/breeds/akita')
    expect(row(/^Akita$/)).toHaveAttribute('aria-expanded', 'true')
  })

  it('has only one row expanded: expanding another collapses the first (FR-D-6)', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()

    await user.click(row(/^Afghan\s*Hound/))
    await user.click(row(/^Akita$/))

    expect(url()).toHaveTextContent('/breeds/akita')
    expect(expandedButtons()).toHaveLength(1)
    expect(row(/^Afghan\s*Hound/)).toHaveAttribute('aria-expanded', 'false')
  })

  it('moves between expansion states with browser back (acceptance 3)', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()
    await user.click(row(/^Afghan\s*Hound/))
    await user.click(row(/^Akita$/))

    await user.click(screen.getByRole('button', { name: 'browser back' }))
    expect(url()).toHaveTextContent('/breeds/hound/afghan')
    expect(row(/^Afghan\s*Hound/)).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: 'browser back' }))
    expect(url()).toHaveTextContent(/^\/breeds$/)
    expect(expandedButtons()).toHaveLength(0)
  })

  it('keeps the query string when expanding and collapsing', async () => {
    const user = userEvent.setup()
    renderAt('/breeds?q=ha&sort=desc')
    await listLoaded()

    await user.click(row(/^Afghan\s*Hound/))
    expect(url()).toHaveTextContent('/breeds/hound/afghan?q=ha&sort=desc')

    await user.click(row(/^Afghan\s*Hound/))
    expect(url()).toHaveTextContent('/breeds?q=ha&sort=desc')
  })
})

describe('opening a URL directly (FR-D-1a)', () => {
  it('shows that sub-breed expanded and no other row', async () => {
    renderAt('/breeds/hound/afghan')
    await listLoaded()

    expect(row(/^Afghan\s*Hound/)).toHaveAttribute('aria-expanded', 'true')
    expect(expandedButtons()).toHaveLength(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a breed without sub-breeds expanded', async () => {
    renderAt('/breeds/akita')
    await listLoaded()

    expect(row(/^Akita$/)).toHaveAttribute('aria-expanded', 'true')
    expect(expandedButtons()).toHaveLength(1)
  })

  it('scrolls the expanded row into view, on a deep link and on a click', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView')
    const user = userEvent.setup()
    renderAt('/breeds/hound/afghan')
    await listLoaded()

    await waitFor(() => expect(scroll).toHaveBeenCalled())
    expect(scroll.mock.contexts.at(-1)).toHaveTextContent('Afghan')

    scroll.mockClear()
    await user.click(row(/^Akita$/))

    await waitFor(() => expect(scroll).toHaveBeenCalled())
    expect(scroll.mock.contexts.at(-1)).toHaveTextContent('Akita')
  })
})

describe('an element that does not exist (FR-D-1b)', () => {
  it.each([
    ['/breeds/hound/nothing', '"hound/nothing" was not found'],
    ['/breeds/hound', '"hound" was not found'],
    ['/breeds/nosuchbreed', '"nosuchbreed" was not found'],
  ])('%s shows the collapsed list and a pop-up naming it', async (path, message) => {
    renderAt(path)
    await listLoaded()

    expect(rows()).toHaveLength(165)
    expect(expandedButtons()).toHaveLength(0)
    // The pop-up is raised in an effect just after the list renders, so wait for it.
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('removes the pop-up when the URL changes', async () => {
    const user = userEvent.setup()
    renderAt('/breeds/hound/nothing')
    await listLoaded()
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.click(row(/^Akita$/))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(row(/^Akita$/)).toHaveAttribute('aria-expanded', 'true')
  })

  it('removes the pop-up when leaving the page', async () => {
    const user = userEvent.setup()
    renderAt('/breeds/hound/nothing')
    await listLoaded()
    await screen.findByRole('alert')

    await user.click(screen.getByRole('link', { name: 'My Pack' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not report a missing element while the list is still loading', () => {
    renderAt('/breeds/hound/afghan')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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

describe('performance (architecture 8)', () => {
  it('re-renders only the rows involved when a row is expanded, not all 165', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()
    const before = tagRenders.count

    await user.click(row(/^Afghan\s*Hound/))

    // Tag renders once per re-rendered sub-breed row; 99 rows have one.
    expect(tagRenders.count - before).toBeLessThanOrEqual(2)
  })
})
