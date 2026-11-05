import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchBreedList } from '../../api/dogApi'
import { API_OUTAGE_MESSAGE, isApiOutage } from '../../api/errors'
import type { ApiCallStatus } from '../../components/ApiStatus'
import { flattenBreeds, type Leaf, type LeafId } from '../../domain/leaf'
import { useNotify } from '../../state/notifications'

export interface BreedsState {
  status: ApiCallStatus
  /** Every leaf, ordered; empty until the list has loaded. */
  leaves: readonly Leaf[]
  /** Lookup by leaf id; empty until the list has loaded. */
  index: ReadonlyMap<LeafId, Leaf>
  /** Starts a fresh request; meant for the Failed state. */
  retry: () => void
}

interface Loaded {
  status: ApiCallStatus
  leaves: readonly Leaf[]
  index: ReadonlyMap<LeafId, Leaf>
}

const NO_LEAVES: readonly Leaf[] = []
const NO_INDEX: ReadonlyMap<LeafId, Leaf> = new Map()
const LOADING: Loaded = { status: 'loading', leaves: NO_LEAVES, index: NO_INDEX }
const FAILED: Loaded = { status: 'failed', leaves: NO_LEAVES, index: NO_INDEX }

const BreedsContext = createContext<BreedsState | null>(null)

/** Loads the breed list once for the whole app (architecture 6.2). */
export function BreedsProvider({ children }: { children: ReactNode }) {
  const { notify, clear } = useNotify()
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded>(LOADING)

  useEffect(() => {
    // Cleanup aborts this run's request. Under React StrictMode (development) the effect
    // runs, is cleaned up and runs again, so the first request is aborted and a second sent.
    // An aborted request is not a failure and must not show an error.
    const controller = new AbortController()

    async function load() {
      try {
        const record = await fetchBreedList(controller.signal)
        if (controller.signal.aborted) return
        const { leaves, index } = flattenBreeds(record)
        setLoaded({ status: 'done', leaves, index })
        clear('api')
      } catch (error) {
        if (controller.signal.aborted) return
        setLoaded(FAILED)
        if (isApiOutage(error)) notify(API_OUTAGE_MESSAGE, 'api')
      }
    }
    void load()

    return () => controller.abort()
  }, [attempt, notify, clear])

  const retry = useCallback(() => {
    setLoaded(LOADING)
    setAttempt((value) => value + 1)
  }, [])

  const value = useMemo(() => ({ ...loaded, retry }), [loaded, retry])

  return <BreedsContext.Provider value={value}>{children}</BreedsContext.Provider>
}

export function useBreeds(): BreedsState {
  const state = useContext(BreedsContext)
  if (state === null) throw new Error('useBreeds must be used inside a BreedsProvider')
  return state
}
