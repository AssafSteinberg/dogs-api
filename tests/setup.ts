import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom does not implement scrollIntoView (used when a row is expanded from the URL).
Element.prototype.scrollIntoView = () => {}

afterEach(() => {
  cleanup()
})
