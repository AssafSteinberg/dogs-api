import '../styles/variables.css'
import styles from './ApiStatus.module.css'

/** The state of one API call, shown to the user (FR-D-8). */
export type ApiCallStatus = 'loading' | 'failed' | 'done'

const LABELS: Record<ApiCallStatus, string> = {
  loading: 'Loading…',
  failed: 'Failed',
  done: 'Done',
}

const iconProps = {
  className: styles.icon,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

function Icon({ status }: { status: ApiCallStatus }) {
  switch (status) {
    case 'loading':
      return (
        <svg {...iconProps} data-icon="spinner">
          <circle cx="8" cy="8" r="6" opacity="0.25" />
          <path d="M8 2a6 6 0 0 1 6 6" />
        </svg>
      )
    case 'failed':
      return (
        <svg {...iconProps} data-icon="cross">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      )
    case 'done':
      return (
        <svg {...iconProps} data-icon="check">
          <path d="M3 8.5l3.5 3.5L13 5" />
        </svg>
      )
  }
}

/**
 * Loading / Failed / Done, each with an icon and a text label (never colour alone).
 * One persistent status region, so a change of status is announced to assistive technology.
 */
export function ApiStatus({ status }: { status: ApiCallStatus }) {
  return (
    <span role="status" className={styles.status} data-status={status}>
      <Icon status={status} />
      <span className={styles.label}>{LABELS[status]}</span>
    </span>
  )
}
