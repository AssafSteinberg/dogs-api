import { describe, expect, it } from 'vitest'
import { leafName, leafTag, parseLeafId, toLeafId } from '../src/domain/leaf'

describe('toLeafId', () => {
  it('joins breed and sub-breed with a slash', () => {
    expect(toLeafId('hound', 'afghan')).toBe('hound/afghan')
  })

  it('uses the breed alone when there is no sub-breed', () => {
    expect(toLeafId('akita', null)).toBe('akita')
  })
})

describe('parseLeafId', () => {
  it('round-trips a sub-breed id', () => {
    const leaf = parseLeafId(toLeafId('hound', 'afghan'))
    expect(leaf).toEqual({ id: 'hound/afghan', breed: 'hound', sub: 'afghan' })
  })

  it('round-trips a breed-only id', () => {
    const leaf = parseLeafId(toLeafId('akita', null))
    expect(leaf).toEqual({ id: 'akita', breed: 'akita', sub: null })
  })

  it.each(['', '/', 'hound/', '/afghan', 'hound/afghan/extra', 'hound afghan', ' '])(
    'rejects the malformed id %j',
    (input) => {
      expect(parseLeafId(input)).toBeNull()
    },
  )
})

describe('leafName', () => {
  it('capitalises the sub-breed for a sub-breed leaf', () => {
    expect(leafName({ id: toLeafId('hound', 'afghan'), breed: 'hound', sub: 'afghan' })).toBe('Afghan')
  })

  it('capitalises the breed for a breed-only leaf', () => {
    expect(leafName({ id: toLeafId('akita', null), breed: 'akita', sub: null })).toBe('Akita')
  })
})

describe('leafTag', () => {
  it('returns the capitalised breed for a sub-breed leaf', () => {
    expect(leafTag({ id: toLeafId('hound', 'afghan'), breed: 'hound', sub: 'afghan' })).toBe('Hound')
  })

  it('returns null for a breed without sub-breeds (FR-M-2)', () => {
    expect(leafTag({ id: toLeafId('akita', null), breed: 'akita', sub: null })).toBeNull()
  })
})
