import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface Notification {
  id: number
  message: string
}

interface NotifyActions {
  /** Shows a red pop-up; a message that is already showing is not shown twice. */
  notify: (message: string) => void
  dismiss: (id: number) => void
  /** Removes every pop-up: used when an API call succeeds again. */
  clear: () => void
}

// Two contexts: the actions never change, so components that only raise
// notifications (often from effects) do not re-render or re-run when the list changes.
const ActionsContext = createContext<NotifyActions | null>(null)
const ListContext = createContext<readonly Notification[] | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<readonly Notification[]>([])
  const nextId = useRef(1)

  const notify = useCallback((message: string) => {
    const id = nextId.current++
    setNotifications((current) =>
      current.some((item) => item.message === message)
        ? current
        : [...current, { id, message }],
    )
  }, [])

  const dismiss = useCallback((id: number) => {
    setNotifications((current) => current.filter((item) => item.id !== id))
  }, [])

  const clear = useCallback(() => {
    setNotifications((current) => (current.length === 0 ? current : []))
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
