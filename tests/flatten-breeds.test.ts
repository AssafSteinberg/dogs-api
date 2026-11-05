import { describe, expect, it } from 'vitest'
import { flattenBreeds, toLeafId } from '../src/domain/leaf'
import breedsFixture from './fixtures/breeds-list-all.json'

describe('flattenBreeds with the real API response', () => {
  const { leaves } = flattenBreeds(breedsFixture.message)

  it('yields 165 leaves: 99 sub-breeds and 66 breeds without sub-breeds (FR-M-1)', () => {
    expect(leaves).toHaveLength(165)
    expect(leaves.filter((leaf) => leaf.sub !== null)).toHaveLength(99)
    expect(leaves.filter((leaf) => leaf.sub === null)).toHaveLength(66)
  })

  it('has unique ids', () => {
    expect(new Set(leaves.map((leaf) => leaf.id)).size).toBe(165)
  })
})

describe('flattenBreeds ordering', () => {
  it('orders leaves by breed, then by sub-breed (FR-M-3)', () => {
    const { leaves } = flattenBreeds({
      terrier: ['norfolk', 'border'],
      akita: [],
      hound: ['basset', 'afghan'],
    })
    expect(leaves.map((leaf) => leaf.id)).toEqual([
      'akita',
      'hound/afghan',
      'hound/basset',
      'terrier/border',
      'terrier/norfolk',
    ])
  })
})

describe('flattenBreeds index', () => {
  const { index } = flattenBreeds(breedsFixture.message)

  it('finds a sub-breed leaf by id', () => {
    expect(index.get(toLeafId('hound', 'afghan'))).toEqual({
      id: 'hound/afghan',
      breed: 'hound',
      sub: 'afghan',
    })
  })

  it('finds a breed-only leaf by id', () => {
    expect(index.get(toLeafId('akita', null))).toEqual({ id: 'akita', breed: 'akita', sub: null })
  })

  it('has no leaf for a breed that has sub-breeds (FR-D-1b)', () => {
    expect(index.get(toLeafId('hound', null))).toBeUndefined()
  })

  it('has no leaf for an unknown sub-breed', () => {
    expect(index.get(toLeafId('hound', 'nothing'))).toBeUndefined()
  })
})

describe('flattenBreeds with no data', () => {
  it('returns an empty list and an empty index', () => {
    const { leaves, index } = flattenBreeds({})
    expect(leaves).toEqual([])
    expect(index.size).toBe(0)
  })
})
