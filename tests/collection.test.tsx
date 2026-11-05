import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toLeafId } from '../src/domain/leaf'
import { CollectionProvider, usePack, useWishlist } from '../src/state/collection'

const KEY = 'dogs-api:v1:collection'
const afghan = toLeafId('hound', 'afghan')
const akita = toLeafId('akita', null)

function Panel() {
  const { pack, add: addToPack, remove: removeFromPack } = usePack()
  const { wishlist, has, add: addToWishlist, remove: removeFromWishlist } = useWishlist()
  return (
    <div>
      <button onClick={() => addToPack(afghan)}>pack +afghan</button>
      <button onClick={() => removeFromPack(afghan)}>pack -afghan</button>
      <button onClick={() => addToWishlist(akita)}>wish +akita</button>
      <button onClick={() => removeFromWishlist(akita)}>wish -akita</button>
      <p data-testid="pack">{JSON.stringify(pack)}</p>
      <p data-testid="wishlist">{JSON.stringify(wishlist)}</p>
      <p data-testid="has-akita">{String(has(akita))}</p>
    </div>
  )
}

function renderPanel() {
  return render(
    <CollectionProvider>
      <Panel />
    </CollectionProvider>,
  )
}

const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('actions update state and persist (FR-U-1)', () => {
  it('updates the Pack and Wishlist and saves them under the versioned key', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'pack +afghan' }))
    await user.click(screen.getByRole('button', { name: 'pack +afghan' }))
    await user.click(screen.getByRole('button', { name: 'wish +akita' }))

    expect(screen.getByTestId('pack')).toHaveTextContent('{"hound/afghan":2}')
    expect(screen.getByTestId('wishlist')).toHaveTextContent('["akita"]')
    expect(screen.getByTestId('has-akita')).toHaveTextContent('true')
    expect(stored()).toEqual({ pack: { 'hound/afghan': 2 }, wishlist: ['akita'] })
  })

  it('saves removals too', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'pack +afghan' }))
    await user.click(screen.getByRole('button', { name: 'wish +akita' }))

    await user.click(screen.getByRole('button', { name: 'pack -afghan' }))
    await user.click(screen.getByRole('button', { name: 'wish -akita' }))

    expect(screen.getByTestId('pack')).toHaveTextContent('{}')
    expect(screen.getByTestId('wishlist')).toHaveTextContent('[]')
    expect(screen.getByTestId('has-akita')).toHaveTextContent('false')
    expect(stored()).toEqual({ pack: {}, wishlist: [] })
  })

  it('keeps a wishlist entry once however often it is added', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'wish +akita' }))
    await user.click(screen.getByRole('button', { name: 'wish +akita' }))

    expect(screen.getByTestId('wishlist')).toHaveTextContent('["akita"]')
  })
})

describe('restoring after a restart (acceptance 5)', () => {
  it('shows the same Pack and Wishlist after the app is mounted again', async () => {
    const user = userEvent.setup()
    const first = renderPanel()
    await user.click(screen.getByRole('button', { name: 'pack +afghan' }))
    await user.click(screen.getByRole('button', { name: 'pack +afghan' }))
    await user.click(screen.getByRole('button', { name: 'wish +akita' }))
    first.unmount()

    renderPanel()

    expect(screen.getByTestId('pack')).toHaveTextContent('{"hound/afghan":2}')
    expect(screen.getByTestId('wishlist')).toHaveTextContent('["akita"]')
  })

  it('works under StrictMode without double counting', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <CollectionProvider>
          <Panel />
        </CollectionProvider>
      </StrictMode>,
    )

    await user.click(screen.getByRole('button', { name: 'pack +afghan' }))

    expect(screen.getByTestId('pack')).toHaveTextContent('{"hound/afghan":1}')
    expect(stored()).toEqual({ pack: { 'hound/afghan': 1 }, wishlist: [] })
  })
})

describe('empty or unreadable storage', () => {
  it('starts empty, and writes nothing until something changes', () => {
    renderPanel()

    expect(screen.getByTestId('pack')).toHaveTextContent('{}')
    expect(screen.getByTestId('wishlist')).toHaveTextContent('[]')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('starts empty when the stored data is corrupt, and replaces it on the first change', async () => {
    localStorage.setItem(KEY, '{not json')
    const user = userEvent.setup()
    renderPanel()
    expect(screen.getByTestId('pack')).toHaveTextContent('{}')
    expect(screen.getByTestId('wishlist')).toHaveTextContent('[]')

    await user.click(screen.getByRole('button', { name: 'wish +akita' }))

    expect(stored()).toEqual({ pack: {}, wishlist: ['akita'] })
  })

  it('keeps working in memory when the browser refuses to store, and says so in the console (FR-U-4)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'pack +afghan' }))

    expect(screen.getByTestId('pack')).toHaveTextContent('{"hound/afghan":1}')
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/will not be saved/))
  })
})

describe('what is stored (FR-U-2)', () => {
  it('holds only leaf ids and counts, no names or images', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'pack +afghan' }))
    await user.click(screen.getByRole('button', { name: 'wish +akita' }))

    const data = stored()

    expect(data).toEqual({ pack: { 'hound/afghan': 1 }, wishlist: ['akita'] })
    const raw = localStorage.getItem(KEY) ?? ''
    expect(raw).not.toMatch(/Afghan|Akita|Hound|https?:|\.jpg/)
  })
})

describe('hooks', () => {
  function PackOutside() {
    usePack()
    return null
  }
  function WishlistOutside() {
    useWishlist()
    return null
  }

  it('usePack throws a clear error outside a CollectionProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<PackOutside />)).toThrow(/CollectionProvider/)
  })

  it('useWishlist throws a clear error outside a CollectionProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<WishlistOutside />)).toThrow(/CollectionProvider/)
  })
})
