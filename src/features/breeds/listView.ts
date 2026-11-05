import type { Leaf } from '../../domain/leaf'

export type SortDirection = 'asc' | 'desc'

function matches(leaf: Leaf, needle: string): boolean {
  return (
    leaf.breed.toLowerCase().includes(needle) ||
    (leaf.sub !== null && leaf.sub.toLowerCase().includes(needle))
  )
}

function compareLeaves(a: Leaf, b: Leaf): number {
  const byBreed = a.breed.localeCompare(b.breed)
  if (byBreed !== 0) return byBreed
  return (a.sub ?? '').localeCompare(b.sub ?? '')
}

/**
 * The master list as shown: filtered by name (case-insensitive "contains" on the
 * breed or sub-breed name), then sorted by breed name, then sub-breed, in the
 * given direction so a breed's sub-breeds stay together. Never mutates its input.
 */
export function applyFilterAndSort(
  leaves: readonly Leaf[],
  query: string,
  direction: SortDirection,
): Leaf[] {
  const needle = query.trim().toLowerCase()
  const kept = needle === '' ? [...leaves] : leaves.filter((leaf) => matches(leaf, needle))
  const sign = direction === 'asc' ? 1 : -1
  return kept.sort((a, b) => sign * compareLeaves(a, b))
}
