import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiStatus, type ApiCallStatus } from '../src/components/ApiStatus'

const LABELS: ReadonlyArray<readonly [ApiCallStatus, string]> = [
  ['loading', 'Loading…'],
  ['failed', 'Failed'],
  ['done', 'Done'],
]

describe('ApiStatus label (FR-D-8)', () => {
  it.each(LABELS)('shows the text label for "%s"', (status, label) => {
    render(<ApiStatus status={status} />)

    expect(screen.getByRole('status')).toHaveTextContent(label)
  })
})

describe('ApiStatus accessibility', () => {
  it.each(LABELS)('is exposed as a status region for "%s"', (status) => {
    render(<ApiStatus status={status} />)

    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('keeps the same region when the status changes, so the change is announced', () => {
    const { rerender } = render(<ApiStatus status="loading" />)
    const region = screen.getByRole('status')

    rerender(<ApiStatus status="done" />)

    expect(screen.getByRole('status')).toBe(region)
    expect(region).toHaveTextContent('Done')
  })
})

describe('ApiStatus icon (not colour alone)', () => {
  it.each(LABELS)('has a decorative icon next to the label for "%s"', (status) => {
    render(<ApiStatus status={status} />)

    const icons = screen.getByRole('status').querySelectorAll('[data-icon]')
    expect(icons).toHaveLength(1)
    expect(icons[0]).toHaveAttribute('aria-hidden', 'true')
  })

  it('uses a different icon for each status', () => {
    const icons = LABELS.map(([status]) => {
      const { container, unmount } = render(<ApiStatus status={status} />)
      const icon = container.querySelector('[data-icon]')?.getAttribute('data-icon')
      unmount()
      return icon
    })

    expect(icons).toEqual(['spinner', 'cross', 'check'])
  })
})
