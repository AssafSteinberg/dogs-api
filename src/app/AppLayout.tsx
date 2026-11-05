import { Outlet } from 'react-router'
import { Sidebar } from '../components/Sidebar'
import '../styles/variables.css'
import styles from './AppLayout.module.css'

/** The frame around every page: the sidebar and the <main> landmark. */
export function AppLayout() {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
