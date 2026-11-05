import type { Leaf } from '../../domain/leaf'
import { useWishlist } from '../../state/collection'
import { BreedItem } from './BreedItem'
import styles from './BreedList.module.css'

/** The master list: one row per leaf, each a link to its own page. */
export function BreedList({ leaves }: { leaves: readonly Leaf[] }) {
  const { has } = useWishlist()

  return (
    <ul className={styles.list}>
      {leaves.map((leaf) => (
        <BreedItem key={leaf.id} id={leaf.id} breed={leaf.breed} sub={leaf.sub} wishlisted={has(leaf.id)} />
      ))}
    </ul>
  )
}
