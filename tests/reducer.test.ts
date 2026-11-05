import { describe, expect, it } from 'vitest'
import { toLeafId } from '../src/domain/leaf'
import { collectionReducer, type CollectionAction } from '../src/state/reducer'
import { emptyCollection, type Collection } from '../src/state/storage'

const afghan = toLeafId('hound', 'afghan')
const basset = toLeafId('hound', 'basset')
const akita = toLeafId('akita', null)

function run(start: Collection, ...actions: CollectionAction[]): Collection {
  return actions.reduce(collectionReducer, start)
}

describe('pack (FR-P-1, FR-P-3)', () => {
  it('counts a leaf added three times as 3', () => {
    const state = run(
      emptyCollection(),
      { type: 'addToPack', id: afghan },
      { type: 'addToPack', id: afghan },
      { type: 'addToPack', id: afghan },
    )

    expect(state.pack).toEqual({ [afghan]: 3 })
  })

  it('counts different leaves separately', () => {
    const state = run(
      emptyCollection(),
      { type: 'addToPack', id: afghan },
      { type: 'addToPack', id: akita },
      { type: 'addToPack', id: afghan },
    )

    expect(state.pack).toEqual({ [afghan]: 2, [akita]: 1 })
  })

  it('removes one at a time and deletes the key when the count reaches zero', () => {
    const start: Collection = { pack: { [afghan]: 2 }, wishlist: [] }

    const afterOne = run(start, { type: 'removeFromPack', id: afghan })
    expect(afterOne.pack).toEqual({ [afghan]: 1 })

    const afterTwo = run(afterOne, { type: 'removeFromPack', id: afghan })
    expect(afterTwo.pack).toEqual({})
    expect(afghan in afterTwo.pack).toBe(false)
  })

  it('changes nothing when removing a leaf that is not in the pack', () => {
    const start: Collection = { pack: { [afghan]: 1 }, wishlist: [akita] }

    expect(collectionReducer(start, { type: 'removeFromPack', id: basset })).toBe(start)
  })
})

describe('wishlist (FR-W-1, FR-W-2)', () => {
  it('keeps one entry when the same leaf is added twice', () => {
    const state = run(
      emptyCollection(),
      { type: 'addToWishlist', id: akita },
      { type: 'addToWishlist', id: akita },
    )

    expect(state.wishlist).toEqual([akita])
  })

  it('keeps the order in which leaves were added', () => {
    const state = run(
      emptyCollection(),
      { type: 'addToWishlist', id: basset },
      { type: 'addToWishlist', id: afghan },
    )

    expect(state.wishlist).toEqual([basset, afghan])
  })

  it('removes a leaf', () => {
    const start: Collection = { pack: {}, wishlist: [afghan, akita] }

    expect(run(start, { type: 'removeFromWishlist', id: afghan }).wishlist).toEqual([akita])
  })

  it('changes nothing when adding an existing leaf or removing an absent one', () => {
    const start: Collection = { pack: {}, wishlist: [akita] }

    expect(collectionReducer(start, { type: 'addToWishlist', id: akita })).toBe(start)
    expect(collectionReducer(start, { type: 'removeFromWishlist', id: afghan })).toBe(start)
  })
})

describe('independence and purity', () => {
  it('keeps pack and wishlist independent: a leaf may be in both', () => {
    const state = run(
      emptyCollection(),
      { type: 'addToPack', id: afghan },
      { type: 'addToWishlist', id: afghan },
    )
    expect(state).toEqual({ pack: { [afghan]: 1 }, wishlist: [afghan] })

    const afterPackRemoval = run(state, { type: 'removeFromPack', id: afghan })
    expect(afterPackRemoval).toEqual({ pack: {}, wishlist: [afghan] })

    const afterWishlistRemoval = run(state, { type: 'removeFromWishlist', id: afghan })
    expect(afterWishlistRemoval).toEqual({ pack: { [afghan]: 1 }, wishlist: [] })
  })

  it('never mutates the state it is given', () => {
    const start: Collection = { pack: { [afghan]: 2 }, wishlist: [akita] }
    const snapshot = JSON.stringify(start)
    Object.freeze(start)
    Object.freeze(start.pack)
    Object.freeze(start.wishlist)

    run(
      start,
      { type: 'addToPack', id: afghan },
      { type: 'addToPack', id: basset },
      { type: 'removeFromPack', id: afghan },
      { type: 'addToWishlist', id: afghan },
      { type: 'removeFromWishlist', id: akita },
    )

    expect(JSON.stringify(start)).toBe(snapshot)
  })
})
