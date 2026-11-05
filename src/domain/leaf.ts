/**
 * A leaf is one element of the master list: a sub-breed, or a breed that has no
 * sub-breeds. Its id doubles as the app URL path (/breeds/<id>) and the API path.
 */
export type LeafId = string & { readonly __brand: 'LeafId' }

export interface Leaf {
  id: LeafId
  /** API key, lowercase: "hound" */
  breed: string
  /** API key, or null for a breed without sub-breeds */
  sub: string | null
}

// One or two non-empty segments, no whitespace: "akita" or "hound/afghan".
const LEAF_ID_PATTERN = /^[^\s/]+(?:\/[^\s/]+)?$/

/** The only place a LeafId is built. */
export function toLeafId(breed: string, sub: string | null): LeafId {
  return (sub === null ? breed : `${breed}/${sub}`) as LeafId
}

/** Splits an id back into a Leaf, or returns null when the id is malformed. */
export function parseLeafId(id: string): Leaf | null {
  if (!LEAF_ID_PATTERN.test(id)) return null
  const [breed = '', sub = null] = id.split('/')
  return { id: toLeafId(breed, sub), breed, sub }
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** Display name: the sub-breed, or the breed when there is no sub-breed. */
export function leafName(leaf: Leaf): string {
  return capitalise(leaf.sub ?? leaf.breed)
}

/** Breed tag shown on sub-breed leaves only; null for a breed without sub-breeds. */
export function leafTag(leaf: Leaf): string | null {
  return leaf.sub === null ? null : capitalise(leaf.breed)
}
