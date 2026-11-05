import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { AsyncState } from '../../components/AsyncState'
import { toLeafId, type LeafId } from '../../domain/leaf'
import { useNotify } from '../../state/notifications'
import { BreedList } from './BreedList'
import { useBreeds } from './BreedsProvider'
import { detailsId } from './detailsId'

/**
 * The master page. The URL is the only source of truth for which row is expanded
 * (architecture section 5): /breeds, /breeds/:breed or /breeds/:breed/:sub.
 */
export function BreedsPage() {
  const { breed, sub } = useParams()
  const { search } = useLocation()
  const navigate = useNavigate()
  const { status, leaves, index, retry } = useBreeds()
  const { notify, clear } = useNotify()

  const requested: LeafId | null =
    breed === undefined ? null : toLeafId(breed, sub === undefined ? null : sub)
  const expandedLeaf = requested === null ? undefined : index.get(requested)
  const expandedId = expandedLeaf === undefined ? null : expandedLeaf.id
  // Only known once the list has loaded: until then nothing can be called missing.
  const missing = status === 'done' && requested !== null && expandedLeaf === undefined ? requested : null

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
      {status === 'done' ? (
        <BreedList leaves={leaves} expandedId={expandedId} onToggle={onToggle} />
      ) : (
        <AsyncState status={status} failedMessage="Couldn't load the list of breeds." onRetry={retry} />
      )}
    </>
  )
}
