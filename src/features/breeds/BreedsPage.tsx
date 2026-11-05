import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import '../../styles/variables.css'
import { BreedList } from './BreedList'
import { useBreeds } from './BreedsProvider'
import styles from './BreedsPage.module.css'
import { BreedsToolbar } from './BreedsToolbar'
import { applyFilterAndSort, type SortDirection } from './listView'

/**
 * The master list page. The filter and the order live in the query string (architecture 5A):
 * /breeds?q=ha&sort=desc. Each row is a link to its own item page; the filter and the order are not
 * carried to it, and the browser's Back button returns to this list with both (FR-M-7).
 */
export function BreedsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { status, leaves, retry } = useBreeds()

  const query = searchParams.get('q') ?? ''
  const sort: SortDirection = searchParams.get('sort') === 'desc' ? 'desc' : 'asc'

  const matches = useMemo(() => applyFilterAndSort(leaves, query, sort), [leaves, query, sort])

  // The filter and the order live in the query string; the defaults are left out. Replacing
  // the entry keeps typing and toggling out of the browser history.
  function changeParams(change: (params: URLSearchParams) => void) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        change(next)
        return next
      },
      { replace: true },
    )
  }
  function onQueryChange(value: string) {
    changeParams((params) => (value === '' ? params.delete('q') : params.set('q', value)))
  }
  function onSortChange(value: SortDirection) {
    changeParams((params) => (value === 'asc' ? params.delete('sort') : params.set('sort', value)))
  }

  return (
    <>
      <h1>Breeds</h1>
      <BreedsToolbar
        status={status}
        query={query}
        sort={sort}
        matchCount={matches.length}
        total={leaves.length}
        onQueryChange={onQueryChange}
        onSortChange={onSortChange}
      />

      {status === 'failed' && (
        <div className={styles.failed}>
          <p className={styles.message}>Couldn't load the list of breeds.</p>
          <button type="button" className={styles.retry} onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {status === 'done' && matches.length === 0 && (
        <p>No breeds match "{query.trim()}". Use Clear filter to see them all.</p>
      )}

      {status === 'done' && <BreedList leaves={matches} />}
    </>
  )
}
