import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { NavLink } from 'react-router'
import '../styles/variables.css'
import styles from './Sidebar.module.css'

const NAV_ID = 'main-nav'

// "Narrow" is the same breakpoint as the layout in AppLayout.module.css (768 px and below).
const NARROW_QUERY = '(max-width: 768px)'

function subscribeToNarrow(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(NARROW_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function isNarrow(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

const LINKS = [
  {
    to: '/breeds',
    label: 'Breeds',
    icon: <path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" />,
  },
  {
    to: '/pack',
    label: 'My Pack',
    icon: (
      <>
        <circle cx="5.5" cy="8.5" r="1.5" />
        <circle cx="10" cy="5.5" r="1.5" />
        <circle cx="14.5" cy="8.5" r="1.5" />
        <path d="M6.5 15c0-2.5 1.7-4 3.5-4s3.5 1.5 3.5 4c0 1.4-1.5 2-3.5 2s-3.5-.6-3.5-2z" />
      </>
    ),
  },
  {
    to: '/wishlist',
    label: 'Wishlist',
    icon: <path d="M10 17s-6.5-4-6.5-8.6A3.4 3.4 0 0 1 10 6.8a3.4 3.4 0 0 1 6.5 1.6C16.5 13 10 17 10 17z" />,
  },
] as const

/**
 * The collapsible navigation (architecture 8.1, FR-NAV-3). Expanded by default.
 * Wide screens: a column that collapses to an icon rail. Narrow screens: a drawer over the
 * content with a backdrop, closed by a link click, Escape or a tap on the backdrop.
 */
export function Sidebar() {
  const narrow = useSyncExternalStore(subscribeToNarrow, isNarrow)
  const [expanded, setExpanded] = useState(true)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)
  // Set by user actions only, so loading the page never takes focus.
  const pendingFocus = useRef<'toggle' | 'first-link' | null>(null)

  const drawerOpen = narrow && expanded

  const closeDrawer = useCallback(() => {
    pendingFocus.current = 'toggle'
    setExpanded(false)
  }, [])

  useEffect(() => {
    const target = pendingFocus.current
    pendingFocus.current = null
    if (target === 'toggle') toggleRef.current?.focus()
    if (target === 'first-link') firstLinkRef.current?.focus()
  }, [expanded])

  useEffect(() => {
    if (!drawerOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeDrawer()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [drawerOpen, closeDrawer])

  function toggle() {
    if (narrow) pendingFocus.current = expanded ? 'toggle' : 'first-link'
    setExpanded(!expanded)
  }

  return (
    <div className={styles.shell} data-narrow={narrow} data-rail={!narrow && !expanded}>
      <div className={styles.bar}>
        <button
          ref={toggleRef}
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={NAV_ID}
          aria-label={expanded ? 'Collapse menu' : 'Expand menu'}
          onClick={toggle}
        >
          <Icon>
            <path d="M3 5h14M3 10h14M3 15h14" />
          </Icon>
        </button>
        <span className={styles.appName}>Dog Breed Explorer</span>
      </div>

      {drawerOpen && <div className={styles.backdrop} data-testid="sidebar-backdrop" onClick={closeDrawer} />}

      <nav id={NAV_ID} aria-label="Main" className={styles.nav} hidden={narrow && !expanded}>
        <ul className={styles.list}>
          {LINKS.map(({ to, label, icon }, index) => (
            <li key={to}>
              {/* Not "end": /breeds stays current while a breed is expanded (/breeds/hound/afghan). */}
              <NavLink
                ref={index === 0 ? firstLinkRef : undefined}
                to={to}
                className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
                onClick={narrow ? closeDrawer : undefined}
              >
                <Icon>{icon}</Icon>
                {/* Visually hidden in the rail, but still the link's accessible name. */}
                <span className={styles.label}>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
