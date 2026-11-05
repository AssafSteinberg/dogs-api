import '../styles/variables.css'
import { ApiStatus, type ApiCallStatus } from './ApiStatus'
import styles from './AsyncState.module.css'

interface AsyncStateProps {
  status: Exclude<ApiCallStatus, 'done'>
  /** Shown next to the Failed status. */
  failedMessage: string
  onRetry: () => void
}

/** What a region shows while its API call is loading or has failed, with a Retry button (FR-M-4, FR-D-5). */
export function AsyncState({ status, failedMessage, onRetry }: AsyncStateProps) {
  if (status === 'loading') return <ApiStatus status="loading" />

  return (
    <div className={styles.failed}>
      <ApiStatus status="failed" />
      <p className={styles.message}>{failedMessage}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}
