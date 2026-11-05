import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/app/App'
import { API_OUTAGE_MESSAGE } from '../src/api/errors'
import { Toast } from '../src/components/Toast'
import { toLeafId, type Leaf } from '../src/domain/leaf'
import { BreedDetails } from '../src/features/breeds/BreedDetails'
import { CollectionProvider } from '../src/state/collection'
import { NotificationsProvider } from '../src/state/notifications'
import breedsFixture from './fixtures/breeds-list-all.json'

// The image cache lives for the whole session, so each test uses its own leaves.
function leaf(breed: string, sub: string | null): Leaf {
  return { id: toLeafId(breed, sub), breed, sub }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const image = (url: string) => json({ status: 'success', message: url })

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderDetails(target: Leaf) {
  return render(
    <NotificationsProvider>
      <Toast />
      <CollectionProvider>
        <BreedDetails leaf={target} />
      </CollectionProvider>
    </NotificationsProvider>,
  )
}

const stored = () => JSON.parse(localStorage.getItem('dogs-api:v1:collection') ?? 'null') as unknown

describe('BreedDetails name and tag (FR-D-3)', () => {
  it('shows a sub-breed name with its breed tag', async () => {
    fetchMock.mockImplementation(async () => image('https://images.dog.ceo/a.jpg'))
    renderDetails(leaf('hound', 'afghan'))

    expect(screen.getByRole('heading', { level: 2, name: 'Afghan Hound' })).toBeInTheDocument()
    expect(screen.getByText('Hound')).toBeInTheDocument()
    await screen.findByRole('img')
  })

  it('shows a breed without sub-breeds with no tag', async () => {
    fetchMock.mockImplementation(async () => image('https://images.dog.ceo/b.jpg'))
    renderDetails(leaf('akita', null))

    expect(screen.getByRole('heading', { level: 2, name: 'Akita' })).toBeInTheDocument()
    expect(screen.queryByText('Akita', { selector: 'span' })).not.toBeInTheDocument()
    await screen.findByRole('img')
  })
})

describe('BreedDetails image (FR-D-2, FR-D-8)', () => {
  it('shows Loading, then the image of the right leaf with the Done status and a named alt text', async () => {
    fetchMock.mockImplementation(async () => image('https://images.dog.ceo/breeds/hound-basset/x.jpg'))
    renderDetails(leaf('hound', 'basset'))

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'https://images.dog.ceo/breeds/hound-basset/x.jpg')
    expect(img).toHaveAccessibleName('Basset Hound')
    expect(screen.getByRole('status')).toHaveTextContent('Done')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://dog.ceo/api/breed/hound/basset/images/random')
  })

  it('uses the breed endpoint and a plain alt text for a breed without sub-breeds', async () => {
    fetchMock.mockImplementation(async () => image('https://images.dog.ceo/breeds/borzoi/y.jpg'))
    renderDetails(leaf('borzoi', null))

    const img = await screen.findByRole('img')
    expect(img).toHaveAccessibleName('Borzoi')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://dog.ceo/api/breed/borzoi/images/random')
  })
})

describe('BreedDetails image failure (FR-D-5)', () => {
  it('names the sub-breed and its breed, shows Failed and Retry, and Retry loads the image', async () => {
    const user = userEvent.setup()
    fetchMock
      .mockImplementationOnce(async () => json({ status: 'error', message: 'Breed not found', code: 404 }, 404))
      .mockImplementation(async () => image('https://images.dog.ceo/breeds/hound-blood/z.jpg'))
    renderDetails(leaf('hound', 'blood'))

    expect(await screen.findByText("Couldn't load an image of Blood Hound")).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Failed')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('img')).toHaveAttribute('src', 'https://images.dog.ceo/breeds/hound-blood/z.jpg')
    expect(screen.queryByText(/Couldn't load an image/)).not.toBeInTheDocument()
  })

  it('names a breed without sub-breeds by its own name only', async () => {
    fetchMock.mockImplementation(async () => json({ status: 'error', message: 'x', code: 404 }, 404))
    renderDetails(leaf('affenpinscher', null))

    expect(await screen.findByText("Couldn't load an image of Affenpinscher")).toBeInTheDocument()
  })

  it('also raises the red outage pop-up when the API cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderDetails(leaf('hound', 'walker'))

    expect(await screen.findByText("Couldn't load an image of Walker Hound")).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(API_OUTAGE_MESSAGE)
  })

  it('shows the same message when the image file itself fails to load, and Retry fetches a new image', async () => {
    const user = userEvent.setup()
    fetchMock
      .mockImplementationOnce(async () => image('https://images.dog.ceo/broken.jpg'))
      .mockImplementation(async () => image('https://images.dog.ceo/fresh.jpg'))
    renderDetails(leaf('hound', 'plott'))
    const img = await screen.findByRole('img')

    fireEvent.error(img)

    expect(await screen.findByText("Couldn't load an image of Plott Hound")).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Failed')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('img')).toHaveAttribute('src', 'https://images.dog.ceo/fresh.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('BreedDetails Add to Pack (FR-P-1)', () => {
  it('adds the same leaf any number of times and shows how many are in the pack', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async () => image('https://images.dog.ceo/p.jpg'))
    renderDetails(leaf('retriever', 'chesapeake'))
    expect(screen.queryByText(/In your pack/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add to Pack' }))
    await user.click(screen.getByRole('button', { name: 'Add to Pack' }))

    expect(screen.getByText('In your pack: 2')).toBeInTheDocument()
    expect(stored()).toEqual({ pack: { 'retriever/chesapeake': 2 }, wishlist: [] })
  })
})

describe('BreedDetails Add to Wishlist (FR-W-1)', () => {
  it('flips to "On wishlist", and clicking it again does not add a duplicate', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async () => image('https://images.dog.ceo/w.jpg'))
    renderDetails(leaf('retriever', 'curly'))

    await user.click(screen.getByRole('button', { name: 'Add to Wishlist' }))

    expect(screen.queryByRole('button', { name: 'Add to Wishlist' })).not.toBeInTheDocument()
    const onList = screen.getByRole('button', { name: 'On wishlist' })
    await user.click(onList)
    expect(stored()).toEqual({ pack: {}, wishlist: ['retriever/curly'] })
  })

  it('offers to remove it from the wishlist', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async () => image('https://images.dog.ceo/w2.jpg'))
    renderDetails(leaf('retriever', 'flatcoated'))
    await user.click(screen.getByRole('button', { name: 'Add to Wishlist' }))

    await user.click(screen.getByRole('button', { name: 'Remove from wishlist' }))

    expect(screen.getByRole('button', { name: 'Add to Wishlist' })).toBeInTheDocument()
    expect(stored()).toEqual({ pack: {}, wishlist: [] })
  })

  it('starts as "On wishlist" when the leaf is already on the wishlist', () => {
    localStorage.setItem(
      'dogs-api:v1:collection',
      JSON.stringify({ pack: {}, wishlist: ['retriever/labrador'] }),
    )
    fetchMock.mockImplementation(async () => image('https://images.dog.ceo/w3.jpg'))
    renderDetails(leaf('retriever', 'labrador'))

    expect(screen.getByRole('button', { name: 'On wishlist' })).toBeInTheDocument()
  })
})

describe('details inside the Breeds page (acceptance 2)', () => {
  function renderApp(url: string) {
    return render(
      <MemoryRouter initialEntries={[url]}>
        <App />
      </MemoryRouter>,
    )
  }

  beforeEach(() => {
    let imageCalls = 0
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/breeds/list/all')) return json(breedsFixture)
      imageCalls += 1
      return image(`https://images.dog.ceo/shot-${imageCalls}.jpg`)
    })
  })

  const main = () => screen.getByRole('main')

  it('shows the details only for the expanded row', async () => {
    renderApp('/breeds/hound/ibizan')

    const region = await screen.findByRole('region', { name: 'Ibizan Hound details' })
    expect(within(main()).getAllByRole('region')).toHaveLength(1)
    expect(await within(region).findByRole('img')).toBeInTheDocument()
  })

  it('shows the same image after collapsing and expanding again, without another request', async () => {
    const user = userEvent.setup()
    // Its own leaf: hound/ibizan was already opened (and cached) by the previous test.
    renderApp('/breeds/spaniel/welsh')
    const region = await screen.findByRole('region', { name: 'Welsh Spaniel details' })
    const first = (await within(region).findByRole('img')).getAttribute('src')
    const imageRequests = () =>
      fetchMock.mock.calls.filter(([input]) => String(input).includes('/images/random')).length
    expect(imageRequests()).toBe(1)

    await user.click(screen.getByRole('button', { name: /^Welsh\s*Spaniel/, expanded: true }))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Welsh\s*Spaniel/ }))

    const again = await screen.findByRole('region', { name: 'Welsh Spaniel details' })
    await waitFor(() => expect(within(again).getByRole('img')).toHaveAttribute('src', first ?? ''))
    expect(imageRequests()).toBe(1)
  })
})
