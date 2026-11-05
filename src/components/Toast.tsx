import { useNotifications, useNotify } from '../state/notifications'
import '../styles/variables.css'
import styles from './Toast.module.css'

/** The red pop-up fixed to the bottom of the screen (FR-D-9). Renders nothing when there is none. */
export function Toast() {
  const notifications = useNotifications()
  const { dismiss } = useNotify()

  if (notifications.length === 0) return null

  return (
    <div className={styles.region}>
      {notifications.map((notification) => (
        <div key={notification.id} role="alert" className={styles.toast}>
          <span className={styles.message}>{notification.message}</span>
          <button
            type="button"
            className={styles.dismiss}
            aria-label="Dismiss notification"
            onClick={() => dismiss(notification.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
