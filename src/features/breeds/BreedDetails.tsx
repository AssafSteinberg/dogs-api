import { useState } from 'react'
import { ApiStatus } from '../../components/ApiStatus'
import { AsyncState } from '../../components/AsyncState'
import { Tag } from '../../components/Tag'
import { leafName, leafTag, type Leaf } from '../../domain/leaf'
import { usePack, useWishlist } from '../../state/collection'
import '../../styles/variables.css'
import styles from './BreedDetails.module.css'
import { detailsId } from './detailsId'
import { useBreedImage } from './useBreedImage'

/**
 * The details of the expanded row (FR-D-2 to D-5): the name and breed tag, one random
 * image with its call status, and the Add to Pack and Wishlist actions.
 */
export function BreedDetails({ leaf }: { leaf: Leaf }) {
  const image = useBreedImage(leaf)
  const { pack, add: addToPack } = usePack()
  const { has, add: addToWishlist, remove: removeFromWishlist } = useWishlist()
  // The image URL whose file failed to load; the URL resolved, but the picture did not.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)

  const name = leafName(leaf)
  const tag = leafTag(leaf)
  // "Afghan (hound)" for a sub-breed, "Akita" for a breed without sub-breeds.
  const label = leaf.sub === null ? name : `${name} (${leaf.breed})`

  const fileFailed = image.url !== null && image.url === brokenUrl
  const status = fileFailed ? 'failed' : image.status
  const inPack = pack[leaf.id] ?? 0
  const onWishlist = has(leaf.id)

  function retry() {
    setBrokenUrl(null)
    image.retry()
  }

  return (
    <section id={detailsId(leaf.id)} className={styles.details} aria-label={`${label} details`}>
      <div className={styles.heading}>
        <h2 className={styles.title}>{name}</h2>
        {tag !== null && <Tag>{tag}</Tag>}
      </div>

      <div className={styles.imageBox}>
        {status === 'done' && image.url !== null ? (
          <>
            <img
              className={styles.image}
              src={image.url}
              alt={label}
              onError={() => setBrokenUrl(image.url)}
            />
            <ApiStatus status="done" />
          </>
        ) : (
          <AsyncState
            status={status === 'failed' ? 'failed' : 'loading'}
            failedMessage={`Couldn't load an image of ${label}`}
            onRetry={retry}
          />
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={() => addToPack(leaf.id)}>
          Add to Pack
        </button>
        {inPack > 0 && <span className={styles.count}>In your pack: {inPack}</span>}

        {onWishlist ? (
          <>
            {/* Already on the list: adding again does nothing (FR-W-1), so this only shows the state. */}
            <button type="button" className={styles.action} disabled>
              On wishlist
            </button>
            <button type="button" className={styles.action} onClick={() => removeFromWishlist(leaf.id)}>
              Remove from wishlist
            </button>
          </>
        ) : (
          <button type="button" className={styles.action} onClick={() => addToWishlist(leaf.id)}>
            Add to Wishlist
          </button>
        )}
      </div>
    </section>
  )
}
