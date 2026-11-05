import { memo, type ReactNode } from 'react'
import { Tag } from '../../components/Tag'
import { leafFullName, leafTag, type LeafId } from '../../domain/leaf'
import '../../styles/variables.css'
import styles from './BreedItem.module.css'
import { detailsId } from './detailsId'

interface BreedItemProps {
  id: LeafId
  breed: string
  sub: string | null
  expanded: boolean
  /** The leaf is on the Wishlist (FR-W-4). */
  wishlisted: boolean
  /** Called with this row's id when its toggle is activated. Keep it stable so the row can be memoised. */
  onToggle: (id: LeafId) => void
  /** The details, shown below the toggle while the row is expanded. */
  children?: ReactNode
}

/**
 * One row of the master list: the name, the breed tag (sub-breeds only) and a toggle
 * that expands the details in place. Only primitive props plus a stable callback,
 * so a URL change re-renders two rows, not all of them (architecture 8).
 */
export const BreedItem = memo(function BreedItem({
  id,
  breed,
  sub,
  expanded,
  wishlisted,
  onToggle,
  children,
}: BreedItemProps) {
  const leaf = { id, breed, sub }
  const tag = leafTag(leaf)

  return (
    <li className={styles.row} data-expanded={expanded}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls={detailsId(id)}
        onClick={() => onToggle(id)}
      >
        <span className={styles.name}>{leafFullName(leaf)}</span>
        {/* The spaces keep the button's accessible name readable: "Afghan Hound", not "AfghanHound". */}
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
        <svg viewBox="0 0 20 20" className={styles.chevron} aria-hidden="true" focusable="false">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {children}
    </li>
  )
})
