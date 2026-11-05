import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockImplementation(respond)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

const main = () => screen.getByRole('main')
const url = () => screen.getByTestId('url')
const filterBox = () => within(main()).getByRole('searchbox', { name: 'Filter breeds' })
const sortButton = () => within(main()).getByRole('button', { name: /^Sort by breed name/ })
const count = () => within(main()).getByText(/^\d+ of \d+$/)
const rows = () => within(main()).queryAllByRole('listitem')
const rowNames = () => rows().map((item) => within(item).getAllByRole('button')[0]?.textContent ?? '')
const row = (name: RegExp) => within(main()).getByRole('button', { name })

async function listLoaded() {
  await waitFor(() => expect(rows().length).toBeGreaterThan(0))
}

// Independent of the code under test: the leaves of the fixture as [breed, sub].
const leaves: Array<[string, string | null]> = Object.entries(breedsFixture.message).flatMap(
  ([breed, subs]): Array<[string, string | null]> =>
    subs.length > 0 ? subs.map((sub): [string, string | null] => [breed, sub]) : [[breed, null]],
)
const matching = (query: string) =>
  leaves.filter(([breed, sub]) => breed.includes(query) || (sub !== null && sub.includes(query))).length

describe('the toolbar before the list is ready (FR-M-7)', () => {
  it('is disabled and shows the list call as Loading', () => {
    renderAt('/breeds')

    expect(filterBox()).toBeDisabled()
    expect(sortButton()).toBeDisabled()
    expect(within(main()).getByRole('status')).toHaveTextContent('Loading…')
  })

  it('is disabled when the list failed to load, with Failed and a Retry button', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderAt('/breeds')

    await waitFor(() => expect(within(main()).getByRole('status')).toHaveTextContent('Failed'))
    expect(filterBox()).toBeDisabled()
    expect(sortButton()).toBeDisabled()
    expect(within(main()).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('is enabled once the list is done, with the call shown as Done and the full count', async () => {
    renderAt('/breeds')
    await listLoaded()

    expect(filterBox()).toBeEnabled()
    expect(sortButton()).toBeEnabled()
    expect(within(main()).getByRole('status')).toHaveTextContent('Done')
    expect(count()).toHaveTextContent('165 of 165')
  })
})

describe('filtering (FR-M-6, FR-M-7)', () => {
  it('narrows the list as you type and puts the filter in the URL', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()

    await user.type(filterBox(), 'afg')

    await waitFor(() => expect(url()).toHaveTextContent('/breeds?q=afg'))
    expect(rows()).toHaveLength(matching('afg'))
    expect(rows()).toHaveLength(1)
    expect(count()).toHaveTextContent('1 of 165')
  })

  it('ignores case and surrounding spaces, and stores the trimmed filter', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()

    await user.type(filterBox(), '  AFG ')

    await waitFor(() => expect(url()).toHaveTextContent('/breeds?q=AFG'))
    expect(rows()).toHaveLength(1)
  })

  it('matches a breed name, so all its sub-breeds stay', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()

    await user.type(filterBox(), 'hound')

    await waitFor(() => expect(rows()).toHaveLength(matching('hound')))
    expect(count()).toHaveTextContent(`${matching('hound')} of 165`)
  })

  it('does not add a history entry for each change: back skips the typing', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()
    await user.type(filterBox(), 'afg')
    await waitFor(() => expect(url()).toHaveTextContent('/breeds?q=afg'))
    await user.click(row(/^Afghan\s*Hound/))
    expect(url()).toHaveTextContent('/breeds/hound/afghan?q=afg')

    await user.click(screen.getByRole('button', { name: 'browser back' }))

    expect(url()).toHaveTextContent(/^\/breeds\?q=afg$/)
  })

  it('shows a message and a Clear filter button when nothing matches; Clear restores the list', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()

    await user.type(filterBox(), 'zzz')

    await waitFor(() => expect(rows()).toHaveLength(0))
    expect(within(main()).getByText(/No breeds match/)).toHaveTextContent('zzz')
    expect(count()).toHaveTextContent('0 of 165')

    await user.click(within(main()).getByRole('button', { name: 'Clear filter' }))

    await waitFor(() => expect(rows()).toHaveLength(165))
    expect(filterBox()).toHaveValue('')
    expect(url()).toHaveTextContent(/^\/breeds$/)
    expect(within(main()).queryByText(/No breeds match/)).not.toBeInTheDocument()
    expect(within(main()).queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument()
  })

  it('omits the filter from the URL again when it is emptied by hand', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()
    await user.type(filterBox(), 'afg')
    await waitFor(() => expect(url()).toHaveTextContent('/breeds?q=afg'))

    await user.clear(filterBox())

    await waitFor(() => expect(url()).toHaveTextContent(/^\/breeds$/))
    expect(rows()).toHaveLength(165)
  })
})

describe('sorting (FR-M-5, FR-M-7)', () => {
  it('starts A to Z, and the toggle reverses the order and puts sort=desc in the URL', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()
    expect(rowNames()[0]).toMatch(/^Affenpinscher/)
    expect(sortButton()).toHaveAccessibleName(/A to Z/)

    await user.click(sortButton())

    expect(url()).toHaveTextContent(/^\/breeds\?sort=desc$/)
    expect(sortButton()).toHaveAccessibleName(/Z to A/)
    expect(rowNames()[0]).toMatch(/^Irish\s*Wolfhound/)
    expect(rowNames().at(-1)).toMatch(/^Affenpinscher/)
  })

  it('omits the default order from the URL when toggled back', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')
    await listLoaded()

    await user.click(sortButton())
    await user.click(sortButton())

    expect(url()).toHaveTextContent(/^\/breeds$/)
    expect(rowNames()[0]).toMatch(/^Affenpinscher/)
  })

  it('keeps a breed together in the chosen direction', async () => {
    const user = userEvent.setup()
    renderAt('/breeds?q=spaniel')
    await listLoaded()
    const ascending = rowNames().map((name) => name.replace(/\s*Spaniel$/, ''))

    await user.click(sortButton())

    const descending = rowNames().map((name) => name.replace(/\s*Spaniel$/, ''))
    expect(descending).toEqual([...ascending].reverse())
  })
})

describe('opening a URL with a filter and an order (FR-M-7)', () => {
  it('applies both and fills the controls', async () => {
    renderAt('/breeds?q=ha&sort=desc')
    await listLoaded()

    expect(filterBox()).toHaveValue('ha')
    expect(sortButton()).toHaveAccessibleName(/Z to A/)
    expect(rows()).toHaveLength(matching('ha'))
    expect(count()).toHaveTextContent(`${matching('ha')} of 165`)
  })
})

describe('expanding keeps the view (FR-M-7)', () => {
  it('keeps the filter and the order in the URL while a row is expanded and collapsed', async () => {
    const user = userEvent.setup()
    renderAt('/breeds?q=ha&sort=desc')
    await listLoaded()
    const first = rowNames()[0] ?? ''

    await user.click(within(rows()[0] as HTMLElement).getAllByRole('button')[0] as HTMLElement)
    expect(url()).toHaveTextContent(/\?q=ha&sort=desc$/)
    expect(rowNames()[0]).toBe(first)

    await user.click(within(rows()[0] as HTMLElement).getAllByRole('button')[0] as HTMLElement)
    expect(url()).toHaveTextContent(/^\/breeds\?q=ha&sort=desc$/)
  })
})

describe('an expanded leaf hidden by the filter stays visible (FR-M-8)', () => {
  it('pins it, expanded, among the matches', async () => {
    renderAt('/breeds/hound/afghan?q=akita')
    await listLoaded()

    expect(rows()).toHaveLength(2)
    expect(row(/^Afghan\s*Hound/)).toHaveAttribute('aria-expanded', 'true')
    expect(row(/^Akita$/)).toHaveAttribute('aria-expanded', 'false')
    expect(count()).toHaveTextContent('1 of 165')
    expect(within(main()).getByRole('region', { name: 'Afghan Hound details' })).toBeInTheDocument()
  })

  it('puts the pinned leaf at its sorted position', async () => {
    renderAt('/breeds/hound/afghan?q=akita')
    await listLoaded()

    // Akita sorts before hound, so the pinned Afghan Hound comes second.
    expect(rowNames()[0]).toMatch(/^Akita/)
    expect(rowNames()[1]).toMatch(/^Afghan\s*Hound/)
  })
})
