import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import type { LeafId } from '../domain/leaf'
import { collectionReducer } from './reducer'
import { loadCollection, saveCollection } from './storage'

export interface PackState {
  /** Count per leaf; every count is at least 1. */
  pack: Readonly<Record<LeafId, number>>
  /** Adds one more of this leaf; the same leaf may be added any number of times (FR-P-1). */
  add: (id: LeafId) => void
  /** Removes one of this leaf (FR-P-3). */
  remove: (id: LeafId) => void
}

export interface WishlistState {
  /** In the order the leaves were added. */
  wishlist: readonly LeafId[]
  has: (id: LeafId) => boolean
  /** Adds the leaf; adding one that is already there does nothing (FR-W-1). */
  add: (id: LeafId) => void
  remove: (id: LeafId) => void
}

const PackContext = createContext<PackState | null>(null)
const WishlistContext = createContext<WishlistState | null>(null)

/**
 * Holds the Pack and Wishlist. Loads them from storage once, on mount, and saves them
 * after every change (architecture 7.2, FR-U-1). If the browser cannot store, it keeps
 * working in memory. Components use usePack() and useWishlist().
 */
export function CollectionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(collectionReducer, undefined, loadCollection)

  // Save every change, but not the state that was just loaded: that would rewrite
  // (and could "repair") storage before the user did anything.
  const loaded = useRef(state)
  useEffect(() => {
    if (state !== loaded.current) saveCollection(state)
  }, [state])

  const pack = useMemo<PackState>(
    () => ({
      pack: state.pack,
      add: (id) => dispatch({ type: 'addToPack', id }),
      remove: (id) => dispatch({ type: 'removeFromPack', id }),
    }),
    [state.pack],
  )

  const wishlist = useMemo<WishlistState>(
    () => ({
      wishlist: state.wishlist,
      has: (id) => state.wishlist.includes(id),
      add: (id) => dispatch({ type: 'addToWishlist', id }),
      remove: (id) => dispatch({ type: 'removeFromWishlist', id }),
    }),
    [state.wishlist],
  )

  return (
    <PackContext.Provider value={pack}>
      <WishlistContext.Provider value={wishlist}>{children}</WishlistContext.Provider>
    </PackContext.Provider>
  )
}

export function usePack(): PackState {
  const pack = useContext(PackContext)
  if (pack === null) throw new Error('usePack must be used inside a CollectionProvider')
  return pack
}

export function useWishlist(): WishlistState {
  const wishlist = useContext(WishlistContext)
  if (wishlist === null) throw new Error('useWishlist must be used inside a CollectionProvider')
  return wishlist
}
