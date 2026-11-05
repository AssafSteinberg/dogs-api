import { useEffect, useRef, useState } from 'react'
import { ApiStatus, type ApiCallStatus } from '../../components/ApiStatus'
import '../../styles/variables.css'
import styles from './BreedsToolbar.module.css'
import type { SortDirection } from './listView'

// How long typing must pause before the filter is written to the URL.
const FILTER_DEBOUNCE_MS = 250

interface BreedsToolbarProps {
  /** The state of the breed-list call; the controls work only once it is done. */
  status: ApiCallStatus
  /** The filter currently in the URL. */
  query: string
  sort: SortDirection
  /** How many leaves match the filter, out of `total`. */
  matchCount: number
  total: number
  /** Called with the trimmed filter, shortly after typing stops, and at once for Clear. */
  onQueryChange: (query: string) => void
  onSortChange: (sort: SortDirection) => void
}

/** Filter box, sort toggle, result count and the status of the list call (architecture 5A). */
export function BreedsToolbar({
  status,
  query,
  sort,
  matchCount,
  total,
  onQueryChange,
  onSortChange,
}: BreedsToolbarProps) {
  const ready = status === 'done'
  const [text, setText] = useState(query)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The last filter this toolbar sent up, so only a change from outside resets the text box.
  const sent = useRef(query)
  // The timer must call the newest callback, not the one from the render that started it.
  const latestOnQueryChange = useRef(onQueryChange)
  useEffect(() => {
    latestOnQueryChange.current = onQueryChange
  })

  // Follow the URL when it changes from outside: a link, browser back or forward.
  useEffect(() => {
    if (query !== sent.current) {
      sent.current = query
      setText(query)
    }
  }, [query])

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  function send(value: string) {
    const trimmed = value.trim()
    sent.current = trimmed
    latestOnQueryChange.current(trimmed)
  }

  function type(value: string) {
    setText(value)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      send(value)
    }, FILTER_DEBOUNCE_MS)
  }

  function clear() {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setText('')
    send('')
  }

  const ascending = sort === 'asc'

  return (
    <div className={styles.toolbar}>
      <div className={styles.field}>
        <label htmlFor="breed-filter" className={styles.label}>
          Filter breeds
        </label>
        <input
          id="breed-filter"
          type="search"
          className={styles.input}
          value={text}
          disabled={!ready}
          autoComplete="off"
          placeholder="Type a breed name"
          onChange={(event) => type(event.target.value)}
        />
      </div>

      {ready && text !== '' && (
        <button type="button" className={styles.button} onClick={clear}>
          Clear filter
        </button>
      )}

      <button
        type="button"
        className={styles.button}
        disabled={!ready}
        aria-label={`Sort by breed name, ${ascending ? 'A to Z' : 'Z to A'}`}
        onClick={() => onSortChange(ascending ? 'desc' : 'asc')}
      >
        {ascending ? 'A → Z' : 'Z → A'}
      </button>

      <div className={styles.info}>
        {ready && (
          <p className={styles.count} aria-live="polite">
            {matchCount} of {total}
          </p>
        )}
        <ApiStatus status={status} />
      </div>
    </div>
  )
}
