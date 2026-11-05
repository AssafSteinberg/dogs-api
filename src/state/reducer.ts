import type { LeafId } from '../domain/leaf'
import type { Collection } from './storage'

export type CollectionAction =
  | { type: 'addToPack'; id: LeafId }
  | { type: 'removeFromPack'; id: LeafId }
  | { type: 'addToWishlist'; id: LeafId }
  | { type: 'removeFromWishlist'; id: LeafId }

/**
 * Pure reducer for the Pack (a count per leaf, FR-P-1, FR-P-3) and the Wishlist
 * (an ordered set, FR-W-1, FR-W-2). The two are independent. An action that would
 * change nothing returns the same state object.
 */
export function collectionReducer(state: Collection, action: CollectionAction): Collection {
  switch (action.type) {
    case 'addToPack':
      return {
        ...state,
        pack: { ...state.pack, [action.id]: (state.pack[action.id] ?? 0) + 1 },
      }

    case 'removeFromPack': {
      const count = state.pack[action.id]
      if (count === undefined) return state
      if (count > 1) {
        return { ...state, pack: { ...state.pack, [action.id]: count - 1 } }
      }
      const pack = { ...state.pack }
      delete pack[action.id]
      return { ...state, pack }
    }

    case 'addToWishlist':
      if (state.wishlist.includes(action.id)) return state
      return { ...state, wishlist: [...state.wishlist, action.id] }

    case 'removeFromWishlist':
      if (!state.wishlist.includes(action.id)) return state
      return { ...state, wishlist: state.wishlist.filter((id) => id !== action.id) }
  }
}
