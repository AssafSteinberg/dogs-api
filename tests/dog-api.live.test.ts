// Live tests: these call the REAL Dog CEO API (no fetch stub), so they need an internet connection.
import { describe, expect, it } from 'vitest'
import { fetchBreedList, fetchRandomImage } from '../src/api/dogApi'
import { toLeafId, flattenBreeds } from '../src/domain/leaf'

const TIMEOUT_MS = 20_000

const afghan = { id: toLeafId('hound', 'afghan'), breed: 'hound', sub: 'afghan' }
const akita = { id: toLeafId('akita', null), breed: 'akita', sub: null }
const nothing = { id: toLeafId('hound', 'nothing'), breed: 'hound', sub: 'nothing' }

describe('Dog CEO API (live)', () => {
  it(
    'returns the real breed list, which flattens into leaves',
    async () => {
      const record = await fetchBreedList()

      expect(record['hound']).toContain('afghan')
      expect(record['akita']).toEqual([])

      const { leaves, index } = flattenBreeds(record)
      expect(leaves.length).toBeGreaterThan(100)
      expect(leaves.some((leaf) => leaf.sub !== null)).toBe(true)
      expect(leaves.some((leaf) => leaf.sub === null)).toBe(true)
      expect(index.get(afghan.id)).toBeDefined()
      expect(index.get(akita.id)).toBeDefined()
      expect(index.get(toLeafId('hound', null))).toBeUndefined()
    },
    TIMEOUT_MS,
  )

  it(
    'returns a random image of the sub-breed for a sub-breed leaf, and the image loads',
    async () => {
      const url = await fetchRandomImage(afghan)

      expect(url).toMatch(/^https:\/\/images\.dog\.ceo\/breeds\/hound-afghan\/.+\.(jpe?g|png)$/i)

      const image = await fetch(url, { method: 'HEAD' })
      expect(image.ok).toBe(true)
      expect(image.headers.get('content-type')).toMatch(/^image\//)
    },
    TIMEOUT_MS,
  )

  it(
    'returns a random image of the breed for a breed without sub-breeds',
    async () => {
      const url = await fetchRandomImage(akita)

      expect(url).toMatch(/^https:\/\/images\.dog\.ceo\/breeds\/akita\/.+\.(jpe?g|png)$/i)
    },
    TIMEOUT_MS,
  )

  it(
    'reports an unknown sub-breed as an http ApiError with status 404',
    async () => {
      await expect(fetchRandomImage(nothing)).rejects.toMatchObject({ kind: 'http', status: 404 })
    },
    TIMEOUT_MS,
  )
})
