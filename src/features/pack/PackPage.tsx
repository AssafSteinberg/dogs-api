import { Link } from 'react-router'
import { AsyncState } from '../../components/AsyncState'
import { Tag } from '../../components/Tag'
import { leafFullName, leafTag, parseLeafId, type Leaf, type LeafId } from '../../domain/leaf'
import { useBreeds } from '../breeds/BreedsProvider'
import { usePack } from '../../state/collection'
import '../../styles/variables.css'
import styles from './PackPage.module.css'

/** A pack entry whose leaf the API no longer lists (FR-U-3). */
interface MissingEntry {
  id: LeafId
  count: number
}

/** The Pack: one row per leaf with how many were added, and a way to remove them (FR-P-2 to P-4). */
export function PackPage() {
  const { pack, remove } = usePack()
  const { status, leaves, index, retry } = useBreeds()

  const entries = Object.entries(pack)

  if (entries.length === 0) {
    return (
      <>
        <h1>My Pack</h1>
        <p>Your pack is empty.</p>
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
        <h1>My Pack</h1>
        <AsyncState status={status} failedMessage="Couldn't load the list of breeds." onRetry={retry} />
      </>
    )
  }

  // In breed order, like the master list; entries the API no longer lists go last.
  const known = leaves.filter((leaf) => (pack[leaf.id] ?? 0) > 0)
  const missing: MissingEntry[] = entries.flatMap(([key, count]) => {
    const parsed = parseLeafId(key)
    return parsed !== null && !index.has(parsed.id) ? [{ id: parsed.id, count }] : []
  })

  return (
    <>
      <h1>My Pack</h1>
      <ul className={styles.list}>
        {known.map((leaf) => (
          <PackRow key={leaf.id} leaf={leaf} count={pack[leaf.id] ?? 0} onRemoveOne={() => remove(leaf.id)} />
        ))}
        {missing.map(({ id, count }) => (
          <li key={id} className={styles.row}>
            <span className={styles.name}>{id}</span> <span className={styles.note}>No longer available</span>{' '}
            <span className={styles.count}>× {count}</span>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${id}`}
              onClick={() => {
                // Removes every copy, one at a time, since the reducer takes one off per action.
                for (let copy = 0; copy < count; copy += 1) remove(id)
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function PackRow({ leaf, count, onRemoveOne }: { leaf: Leaf; count: number; onRemoveOne: () => void }) {
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
      )}{' '}
      <span className={styles.count}>× {count}</span>
      <button type="button" className={styles.remove} aria-label={`Remove one ${name}`} onClick={onRemoveOne}>
        Remove one
      </button>
    </li>
  )
}
