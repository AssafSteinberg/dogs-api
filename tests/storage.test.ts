import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toLeafId } from '../src/domain/leaf'
import {
  emptyCollection,
  loadCollection,
  saveCollection,
} from '../src/state/storage'

const KEY = 'dogs-api:v1:collection'

const afghan = toLeafId('hound', 'afghan')
const akita = toLeafId('akita', null)

beforeEach(() => {
  localStorage.clear()
  // The warning for unavailable storage is checked in its own tests; keep the output of the others clean.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('saving and loading', () => {
  it('returns the empty collection when nothing is stored', () => {
    expect(loadCollection()).toEqual({ pack: {}, wishlist: [] })
    expect(loadCollection()).toEqual(emptyCollection())
  })

  it('returns what was saved', () => {
    const collection = { pack: { [afghan]: 3, [akita]: 1 }, wishlist: [akita, afghan] }

    saveCollection(collection)

    expect(loadCollection()).toEqual(collection)
  })

  it('stores only ids and counts under the versioned key (FR-U-2)', () => {
    saveCollection({ pack: { [afghan]: 2 }, wishlist: [akita] })

    const raw = localStorage.getItem(KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw ?? '')).toEqual({ pack: { 'hound/afghan': 2 }, wishlist: ['akita'] })
  })
})

describe('unreadable data is replaced with the empty collection (FR-U-3)', () => {
  it.each(['{not json', '"text"', 'null', '[]', '42'])('corrupt or non-object JSON %s', (raw) => {
    localStorage.setItem(KEY, raw)

    expect(loadCollection()).toEqual(emptyCollection())
  })

  it('ignores data stored under a different schema version', () => {
    localStorage.setItem(
      'dogs-api:v2:collection',
      JSON.stringify({ pack: { akita: 1 }, wishlist: ['akita'] }),
    )

    expect(loadCollection()).toEqual(emptyCollection())
  })

  it.each([
    ['a missing pack', { wishlist: ['akita'] }],
    ['a missing wishlist', { pack: { akita: 1 } }],
    ['a pack that is an array', { pack: [], wishlist: [] }],
    ['a wishlist that is an object', { pack: {}, wishlist: {} }],
  ])('data with %s', (_label, payload) => {
    localStorage.setItem(KEY, JSON.stringify(payload))

    expect(loadCollection()).toEqual(emptyCollection())
  })
})

describe('invalid entries are discarded, valid ones kept', () => {
  it('drops pack counts that are not positive integers', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        pack: {
          'hound/afghan': 2,
          akita: 0,
          'hound/basset': -1,
          'terrier/norfolk': 1.5,
          'bulldog/french': '3',
          'poodle/toy': null,
        },
        wishlist: [],
      }),
    )

    expect(loadCollection()).toEqual({ pack: { 'hound/afghan': 2 }, wishlist: [] })
  })

  it('drops malformed ids and non-string wishlist items, and removes duplicates', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        pack: { 'a/b/c': 1, akita: 1 },
        wishlist: ['akita', 'akita', 'hound/afghan', 7, 'bad id', ''],
      }),
    )

    expect(loadCollection()).toEqual({ pack: { akita: 1 }, wishlist: ['akita', 'hound/afghan'] })
  })

  it('keeps well-formed ids the API may no longer list (shown as unavailable later)', () => {
    localStorage.setItem(KEY, JSON.stringify({ pack: {}, wishlist: ['hound/retired'] }))

    expect(loadCollection().wishlist).toEqual(['hound/retired'])
  })
})

describe('when storage is blocked or broken (FR-U-4)', () => {
  it('does not throw on read or write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(loadCollection()).toEqual(emptyCollection())
    expect(() => saveCollection({ pack: { [akita]: 1 }, wishlist: [] })).not.toThrow()
  })

  it('copes with window.localStorage itself throwing', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(loadCollection()).toEqual(emptyCollection())
    expect(() => saveCollection(emptyCollection())).not.toThrow()
  })
})

describe('console warning when storage cannot be used (FR-U-4)', () => {
  // The warning is shown once per page load, which is state of the module, so each test gets a fresh one.
  async function freshStorage() {
    vi.resetModules()
    return await import('../src/state/storage')
  }

  it('warns when reading is blocked', async () => {
    const { loadCollection } = await freshStorage()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    loadCollection()

    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/will not be saved/))
  })

  it('warns when writing is blocked or the storage is full', async () => {
    const { saveCollection, emptyCollection } = await freshStorage()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    saveCollection(emptyCollection())

    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/will not be saved/))
  })

  it('warns when window.localStorage itself throws', async () => {
    const { loadCollection } = await freshStorage()
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    loadCollection()

    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('warns only once, however many reads and writes fail', async () => {
    const { loadCollection, saveCollection, emptyCollection } = await freshStorage()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    loadCollection()
    saveCollection(emptyCollection())
    saveCollection(emptyCollection())

    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('does not warn when storage works', async () => {
    const { loadCollection, saveCollection } = await freshStorage()

    saveCollection({ pack: { [akita]: 1 }, wishlist: [] })
    loadCollection()

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not warn for stored data that is merely corrupt: storage itself works', async () => {
    const { loadCollection } = await freshStorage()
    localStorage.setItem(KEY, '{not json')

    loadCollection()
    localStorage.setItem(KEY, JSON.stringify({ pack: [], wishlist: {} }))
    loadCollection()

    expect(console.warn).not.toHaveBeenCalled()
  })
})
