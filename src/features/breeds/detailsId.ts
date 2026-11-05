import type { LeafId } from '../../domain/leaf'

/** The DOM id of a leaf's details region, which its toggle button controls (aria-controls). */
export function detailsId(id: LeafId): string {
  return `details-${id.replace('/', '--')}`
}
