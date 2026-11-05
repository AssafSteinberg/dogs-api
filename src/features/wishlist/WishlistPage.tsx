import { Link } from 'react-router'
import { AsyncState } from '../../components/AsyncState'
import { Tag } from '../../components/Tag'
import { leafFullName, leafTag, type Leaf, type LeafId } from '../../domain/leaf'
import { useWishlist } from '../../state/collection'
import '../../styles/variables.css'
import { useBreeds } from '../breeds/BreedsProvider'
import styles from './WishlistPage.module.css'

/** The Wishlist: the breeds the user wants, in the order they were added (FR-W-2, FR-W-3). */
export function WishlistPage() {
  const { wishlist, remove } = useWishlist()
  const { status, index, retry } = useBreeds()

  if (wishlist.length === 0) {
    return (
      <>
        <h1>Wishlist</h1>
        <p>Your wishlist is empty.</p>
        <Link to="/breeds" className={styles.link}>
          Browse breeds
        </Link>
      </>
    )
  }

  // The names come from the breed list, so the rows wait for it.
  if (status !== 'done') {
    return (
      <>
        <h1>Wishlist</h1>
        <AsyncState status={status} failedMessage="Couldn't load the list of breeds." onRetry={retry} />
      </>
    )
  }

  return (
    <>
      <h1>Wishlist</h1>
      <ul className={styles.list}>
        {wishlist.map((id) => {
          const leaf = index.get(id)
          return leaf === undefined ? (
            <MissingRow key={id} id={id} onRemove={() => remove(id)} />
          ) : (
            <WishlistRow key={id} leaf={leaf} onRemove={() => remove(id)} />
          )
        })}
      </ul>
    </>
  )
}

function WishlistRow({ leaf, onRemove }: { leaf: Leaf; onRemove: () => void }) {
  const name = leafFullName(leaf)
  const tag = leafTag(leaf)

  return (
    <li className={styles.row}>
      <span className={styles.name}>{name}</span>
      {tag !== null && (
        <>
          {' '}
          <Tag>{tag}</Tag>
        </>
      )}
      <button type="button" className={styles.remove} aria-label={`Remove ${name} from wishlist`} onClick={onRemove}>
        Remove
      </button>
    </li>
  )
}

/** An entry whose leaf the API no longer lists (FR-U-3): shown by its id, never sent to the image API. */
function MissingRow({ id, onRemove }: { id: LeafId; onRemove: () => void }) {
  return (
    <li className={styles.row}>
      <span className={styles.name}>{id}</span> <span className={styles.note}>No longer available</span>
      <button type="button" className={styles.remove} aria-label={`Remove ${id} from wishlist`} onClick={onRemove}>
        Remove
      </button>
    </li>
  )
}
