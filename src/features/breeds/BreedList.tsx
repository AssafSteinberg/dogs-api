import type { Leaf, LeafId } from '../../domain/leaf'
import { useWishlist } from '../../state/collection'
import { BreedDetails } from './BreedDetails'
import { BreedItem } from './BreedItem'
import styles from './BreedList.module.css'

interface BreedListProps {
  leaves: readonly Leaf[]
  /** The one expanded leaf, from the URL, or null. */
  expandedId: LeafId | null
  /** Stable, so unaffected rows stay memoised. */
  onToggle: (id: LeafId) => void
}

/** The master list: one row per leaf, with the details of the expanded one shown in place. */
export function BreedList({ leaves, expandedId, onToggle }: BreedListProps) {
  const { has } = useWishlist()

  return (
    <ul className={styles.list}>
      {leaves.map((leaf) => {
        const expanded = leaf.id === expandedId
        return (
          <BreedItem
            key={leaf.id}
            id={leaf.id}
            breed={leaf.breed}
            sub={leaf.sub}
            expanded={expanded}
            wishlisted={has(leaf.id)}
            onToggle={onToggle}
          >
            {expanded ? <BreedDetails leaf={leaf} /> : null}
          </BreedItem>
        )
      })}
    </ul>
  )
}
