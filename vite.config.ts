import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: 'tests/setup.ts',
    globals: false,
    projects: [
      {
        // Offline tests: the milestone gate (`npm test`).
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: ['tests/**/*.live.test.{ts,tsx}'],
        },
      },
      {
        // Tests that call the real Dog CEO API (`npm run test:live`); need internet.
        extends: true,
        test: {
          name: 'live',
          include: ['tests/**/*.live.test.{ts,tsx}'],
        },
      },
    ],
  },
})
