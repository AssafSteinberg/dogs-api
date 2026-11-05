import { memo } from 'react'
import { Link } from 'react-router'
import { Tag } from '../../components/Tag'
import { leafFullName, leafTag, type LeafId } from '../../domain/leaf'
import '../../styles/variables.css'
import styles from './BreedItem.module.css'

interface BreedItemProps {
  id: LeafId
  breed: string
  sub: string | null
  /** The leaf is on the Wishlist (FR-W-4). */
  wishlisted: boolean
}

/**
 * One row of the master list: a link to the element's own page, holding its full name,
 * the breed tag (sub-breeds only) and the wishlist marker (FR-D-1, FR-M-2). The link carries
 * no query string, so the filter and the order are not part of the item URL. Only primitive
 * props, so rows whose props did not change are not re-rendered (architecture 8).
 */
export const BreedItem = memo(function BreedItem({ id, breed, sub, wishlisted }: BreedItemProps) {
  const leaf = { id, breed, sub }
  const tag = leafTag(leaf)

  return (
    <li className={styles.row}>
      <Link to={`/breeds/${id}`} className={styles.link}>
        <span className={styles.name}>{leafFullName(leaf)}</span>
        {/* The spaces keep the link's accessible name readable: "Afghan Hound", not "AfghanHound". */}
        {tag !== null && (
          <>
            {' '}
            <Tag>{tag}</Tag>
          </>
        )}
        {wishlisted && (
          <span className={styles.marker}>
            {' '}
            <svg viewBox="0 0 20 20" className={styles.heart} aria-hidden="true" focusable="false">
              <path d="M10 17s-6.5-4-6.5-8.6A3.4 3.4 0 0 1 10 6.8a3.4 3.4 0 0 1 6.5 1.6C16.5 13 10 17 10 17z" />
            </svg>
            <span className={styles.visuallyHidden}>On wishlist</span>
          </span>
        )}
      </Link>
    </li>
  )
})
