import { parseLeafId, type LeafId } from '../domain/leaf'

/** What the user has collected. Only ids and counts are ever stored (FR-U-2). */
export interface Collection {
  /** Count per leaf; every count is an integer >= 1. */
  pack: Record<LeafId, number>
  /** Ordered set of leaf ids. */
  wishlist: LeafId[]
}

// The schema version is part of the key: a future schema uses a new key, and old data is ignored.
const COLLECTION_KEY = 'dogs-api:v1:collection'
const PROBE_KEY = 'dogs-api:probe'

let warnedUnavailable = false

/** Tells the console, once per page load, that nothing will be saved (FR-U-4). There is no on-screen banner. */
function warnStorageUnavailable(): void {
  if (warnedUnavailable) return
  warnedUnavailable = true
  console.warn('Dog Breed Explorer: browser storage is unavailable, so your Pack and Wishlist will not be saved.')
}

export function emptyCollection(): Collection {
  return { pack: {}, wishlist: [] }
}

/** window.localStorage itself can throw (blocked cookies, some private modes). */
function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Keeps the valid parts of stored data; returns null when its overall shape is wrong. */
function parseCollection(value: unknown): Collection | null {
  if (!isRecord(value)) return null
  const { pack: storedPack, wishlist: storedWishlist } = value
  if (!isRecord(storedPack) || !Array.isArray(storedWishlist)) return null

  const pack: Record<LeafId, number> = {}
  for (const [key, count] of Object.entries(storedPack)) {
    const leaf = parseLeafId(key)
    if (leaf !== null && typeof count === 'number' && Number.isInteger(count) && count >= 1) {
      pack[leaf.id] = count
    }
  }

  const items: unknown[] = storedWishlist
  const wishlist: LeafId[] = []
  for (const item of items) {
    const leaf = typeof item === 'string' ? parseLeafId(item) : null
    if (leaf !== null && !wishlist.includes(leaf.id)) wishlist.push(leaf.id)
  }

  return { pack, wishlist }
}

/** The stored collection, or an empty one when nothing usable is stored. Never throws. */
export function loadCollection(): Collection {
  const storage = getStorage()
  if (storage === null) {
    warnStorageUnavailable()
    return emptyCollection()
  }

  let raw: string | null
  try {
    raw = storage.getItem(COLLECTION_KEY)
  } catch {
    warnStorageUnavailable()
    return emptyCollection()
  }
  if (raw === null) return emptyCollection()

  // Unreadable data is not an unavailable storage: start empty without a warning.
  try {
    return parseCollection(JSON.parse(raw)) ?? emptyCollection()
  } catch {
    return emptyCollection()
  }
}

/** Stores the collection. Never throws; if it cannot, the app keeps working in memory and the console says so once. */
export function saveCollection(collection: Collection): void {
  const storage = getStorage()
  if (storage === null) {
    warnStorageUnavailable()
    return
  }
  try {
    storage.setItem(COLLECTION_KEY, JSON.stringify(collection))
  } catch {
    warnStorageUnavailable()
  }
}

/** True when the browser lets us write to localStorage. */
export function isStorageAvailable(): boolean {
  const storage = getStorage()
  if (storage === null) return false
  try {
    storage.setItem(PROBE_KEY, '1')
    storage.removeItem(PROBE_KEY)
    return true
  } catch {
    return false
  }
}
