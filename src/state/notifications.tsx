import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/** Where a pop-up came from, so it can be cleared when that cause goes away. */
export type NotificationSource = 'api' | 'route'

export interface Notification {
  id: number
  kind: 'error'
  source: NotificationSource
  message: string
}

interface NotifyActions {
  /** Shows a red pop-up; a message that is already showing is not shown twice. */
  notify: (message: string, source: NotificationSource) => void
  dismiss: (id: number) => void
  /** Removes every pop-up of the given source. */
  clear: (source: NotificationSource) => void
}

// Two contexts: the actions never change, so components that only raise
// notifications (often from effects) do not re-render or re-run when the list changes.
const ActionsContext = createContext<NotifyActions | null>(null)
const ListContext = createContext<readonly Notification[] | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<readonly Notification[]>([])
  const nextId = useRef(1)

  const notify = useCallback((message: string, source: NotificationSource) => {
    const id = nextId.current++
    setNotifications((current) =>
      current.some((item) => item.message === message)
        ? current
        : [...current, { id, kind: 'error', source, message }],
    )
  }, [])

  const dismiss = useCallback((id: number) => {
    setNotifications((current) => current.filter((item) => item.id !== id))
  }, [])

  const clear = useCallback((source: NotificationSource) => {
    setNotifications((current) => {
      const kept = current.filter((item) => item.source !== source)
      return kept.length === current.length ? current : kept
    })
  }, [])

  const actions = useMemo(() => ({ notify, dismiss, clear }), [notify, dismiss, clear])

  return (
    <ActionsContext.Provider value={actions}>
      <ListContext.Provider value={notifications}>{children}</ListContext.Provider>
    </ActionsContext.Provider>
  )
}

export function useNotify(): NotifyActions {
  const actions = useContext(ActionsContext)
  if (actions === null) throw new Error('useNotify must be used inside a NotificationsProvider')
  return actions
}

/** The pop-ups currently showing; used by Toast. */
export function useNotifications(): readonly Notification[] {
  const notifications = useContext(ListContext)
  if (notifications === null) {
    throw new Error('useNotifications must be used inside a NotificationsProvider')
  }
  return notifications
}
