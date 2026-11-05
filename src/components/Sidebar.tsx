import { NavLink } from 'react-router'
import '../styles/variables.css'
import styles from './Sidebar.module.css'

const LINKS = [
  { to: '/breeds', label: 'Breeds' },
  { to: '/pack', label: 'My Pack' },
  { to: '/wishlist', label: 'Wishlist' },
] as const

/** Links to the three pages; the current one is marked (FR-NAV-1). Collapsing comes in T14. */
export function Sidebar() {
  return (
    <nav aria-label="Main" className={styles.sidebar}>
      <p className={styles.title}>Dog Breed Explorer</p>
      <ul className={styles.list}>
        {LINKS.map(({ to, label }) => (
          <li key={to}>
            {/* Not "end": /breeds stays current while a breed is expanded (/breeds/hound/afghan). */}
            <NavLink
              to={to}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
