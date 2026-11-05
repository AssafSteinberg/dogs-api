import type { ReactNode } from 'react'
import '../styles/variables.css'
import styles from './Tag.module.css'

/** A small chip; used to name the breed a sub-breed belongs to (FR-M-2). */
export function Tag({ children }: { children: ReactNode }) {
  return <span className={styles.tag}>{children}</span>
}
