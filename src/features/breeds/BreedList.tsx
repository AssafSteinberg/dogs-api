import type { Leaf, LeafId } from '../../domain/leaf'
import { useWishlist } from '../../state/collection'
import { BreedItem } from './BreedItem'
import styles from './BreedList.module.css'

interface BreedListProps {
  leaves: readonly Leaf[]
  /** Stable, so the memoised rows are not re-rendered needlessly. */
  onToggle: (id: LeafId) => void
}

/** The master list: one row per leaf. */
export function BreedList({ leaves, onToggle }: BreedListProps) {
  const { has } = useWishlist()

  return (
    <ul className={styles.list}>
      {leaves.map((leaf) => (
        <BreedItem
          key={leaf.id}
          id={leaf.id}
          breed={leaf.breed}
          sub={leaf.sub}
          expanded={false}
          wishlisted={has(leaf.id)}
          onToggle={onToggle}
        />
      ))}
    </ul>
  )
}
