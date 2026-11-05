import { describe, expect, it } from 'vitest'
import { toLeafId, type Leaf } from '../src/domain/leaf'
import { applyFilterAndSort } from '../src/features/breeds/listView'

function leaf(breed: string, sub: string | null = null): Leaf {
  return { id: toLeafId(breed, sub), breed, sub }
}

// Deliberately not in sorted order.
const leaves: Leaf[] = [
  leaf('terrier', 'norfolk'),
  leaf('hound', 'basset'),
  leaf('akita'),
  leaf('deerhound', 'scottish'),
  leaf('hound', 'afghan'),
  leaf('bulldog', 'french'),
]

function ids(result: readonly Leaf[]): string[] {
  return result.map((item) => item.id)
}

describe('applyFilterAndSort: filtering (FR-M-6)', () => {
  it('matches the breed name, so a breed keeps all its sub-breeds', () => {
    expect(ids(applyFilterAndSort(leaves, 'hound', 'asc'))).toEqual([
      'deerhound/scottish',
      'hound/afghan',
      'hound/basset',
    ])
  })

  it('matches the sub-breed name', () => {
    expect(ids(applyFilterAndSort(leaves, 'afg', 'asc'))).toEqual(['hound/afghan'])
  })

  it('ignores case and surrounding whitespace', () => {
    expect(ids(applyFilterAndSort(leaves, '  SCOT ', 'asc'))).toEqual(['deerhound/scottish'])
    expect(ids(applyFilterAndSort(leaves, '  HOUND  ', 'asc'))).toEqual(
      ids(applyFilterAndSort(leaves, 'hound', 'asc')),
    )
  })

  it('matches a breed without sub-breeds by its own name', () => {
    expect(ids(applyFilterAndSort(leaves, 'aki', 'asc'))).toEqual(['akita'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(applyFilterAndSort(leaves, 'zzz', 'asc')).toEqual([])
  })

  it.each(['', '   '])('returns every leaf for the empty query %j', (query) => {
    expect(applyFilterAndSort(leaves, query, 'asc')).toHaveLength(leaves.length)
  })
})

describe('applyFilterAndSort: sorting (FR-M-5)', () => {
  it('sorts ascending by breed, then sub-breed', () => {
    expect(ids(applyFilterAndSort(leaves, '', 'asc'))).toEqual([
      'akita',
      'bulldog/french',
      'deerhound/scottish',
      'hound/afghan',
      'hound/basset',
      'terrier/norfolk',
    ])
  })

  it('sorts descending, with sub-breeds of a breed staying together in the same direction', () => {
    expect(ids(applyFilterAndSort(leaves, '', 'desc'))).toEqual([
      'terrier/norfolk',
      'hound/basset',
      'hound/afghan',
      'deerhound/scottish',
      'bulldog/french',
      'akita',
    ])
  })
})

describe('applyFilterAndSort: order of operations and purity', () => {
  it('filters first, then sorts the matches', () => {
    expect(ids(applyFilterAndSort(leaves, 'hound', 'desc'))).toEqual([
      'hound/basset',
      'hound/afghan',
      'deerhound/scottish',
    ])
  })

  it('does not mutate its input and returns a new array', () => {
    const input = Object.freeze([...leaves])
    const before = ids(input)

    const result = applyFilterAndSort(input, '', 'asc')

    expect(ids(input)).toEqual(before)
    expect(result).not.toBe(input)
  })
})
