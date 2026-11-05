import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { toLeafId, type LeafId } from '../../domain/leaf'
import { useNotify } from '../../state/notifications'
import { BreedList } from './BreedList'
import { useBreeds } from './BreedsProvider'
import { BreedsToolbar } from './BreedsToolbar'
import { detailsId } from './detailsId'
import { applyFilterAndSort, type SortDirection } from './listView'

/**
 * The master page. The URL is the only source of truth for which row is expanded
 * (architecture section 5), and for the filter and the order (5A):
 * /breeds/:breed/:sub?q=ha&sort=desc.
 */
export function BreedsPage() {
  const { breed, sub } = useParams()
  const { search } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { status, leaves, index, retry } = useBreeds()
  const { notify, clear } = useNotify()

  const query = searchParams.get('q') ?? ''
  const sort: SortDirection = searchParams.get('sort') === 'desc' ? 'desc' : 'asc'

  const requested: LeafId | null =
    breed === undefined ? null : toLeafId(breed, sub === undefined ? null : sub)
  const expandedLeaf = requested === null ? undefined : index.get(requested)
  const expandedId = expandedLeaf === undefined ? null : expandedLeaf.id
  // Only known once the list has loaded: until then nothing can be called missing.
  const missing = status === 'done' && requested !== null && expandedLeaf === undefined ? requested : null

  const matches = useMemo(() => applyFilterAndSort(leaves, query, sort), [leaves, query, sort])
  // An expanded leaf the filter would hide (say, opened from a link) stays visible, at its sorted place (FR-M-8).
  const shown = useMemo(
    () =>
      expandedLeaf !== undefined && !matches.includes(expandedLeaf)
        ? applyFilterAndSort([...matches, expandedLeaf], '', sort)
        : matches,
    [matches, expandedLeaf, sort],
  )

  // A stable toggle keeps the 165 memoised rows from re-rendering on every URL change,
  // so it reads the current values from a ref instead of closing over them.
  const latest = useRef({ navigate, expandedId, search })
  useEffect(() => {
    latest.current = { navigate, expandedId, search }
  })
  const onToggle = useCallback((id: LeafId) => {
    const { navigate: go, expandedId: current, search: query } = latest.current
    go({ pathname: id === current ? '/breeds' : `/breeds/${id}`, search: query })
  }, [])

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

  // The red pop-up for a URL that names no element; it goes away when the URL changes (FR-D-1b).
  useEffect(() => {
    if (missing === null) return
    notify(`"${missing}" was not found`, 'route')
    return () => clear('route')
  }, [missing, notify, clear])

  // Bring the expanded row into view, also when the page was opened on a deep link (FR-D-1a).
  useEffect(() => {
    if (expandedId === null) return
    document.getElementById(detailsId(expandedId))?.closest('li')?.scrollIntoView({ block: 'nearest' })
  }, [expandedId])

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
        <div>
          <p>Couldn't load the list of breeds.</p>
          <button type="button" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {status === 'done' && matches.length === 0 && (
        <p>No breeds match "{query.trim()}". Use Clear filter to see them all.</p>
      )}

      {status === 'done' && <BreedList leaves={shown} expandedId={expandedId} onToggle={onToggle} />}
    </>
  )
}
