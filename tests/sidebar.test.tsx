import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '../src/components/Sidebar'

/** jsdom has no matchMedia; this makes "(max-width: ...)" queries match only on a narrow screen. */
function setViewport(viewport: 'narrow' | 'wide') {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList => ({
      matches: viewport === 'narrow' && query.includes('max-width'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/breeds']}>
      <Sidebar />
    </MemoryRouter>,
  )
}

const toggle = () => screen.getByRole('button', { name: /menu$/i })
const nav = () => screen.getByRole('navigation', { name: 'Main' })
const backdrop = () => screen.queryByTestId('sidebar-backdrop')

describe('wide screen (FR-NAV-3)', () => {
  it('starts expanded, with a labelled toggle that controls the navigation', () => {
    setViewport('wide')
    renderSidebar()

    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(toggle()).toHaveAccessibleName('Collapse menu')
    expect(toggle()).toHaveAttribute('aria-controls', nav().id)
    expect(nav().id).not.toBe('')
    expect(within(nav()).getAllByRole('link')).toHaveLength(3)
  })

  it('collapses to a rail and expands again; the links stay reachable by name', async () => {
    setViewport('wide')
    const user = userEvent.setup()
    renderSidebar()

    await user.click(toggle())

    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(toggle()).toHaveAccessibleName('Expand menu')
    expect(within(nav()).getByRole('link', { name: 'Breeds' })).toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: 'My Pack' })).toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: 'Wishlist' })).toBeInTheDocument()

    await user.click(toggle())

    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(toggle()).toHaveAccessibleName('Collapse menu')
  })

  it('has no backdrop, and neither Escape nor a link click collapses it', async () => {
    setViewport('wide')
    const user = userEvent.setup()
    renderSidebar()

    expect(backdrop()).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('link', { name: 'My Pack' }))

    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('narrow screen drawer (FR-NAV-3)', () => {
  it('starts expanded, as an open drawer with a backdrop', () => {
    setViewport('narrow')
    renderSidebar()

    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(nav()).toBeVisible()
    expect(backdrop()).toBeInTheDocument()
  })

  it('does not take focus when the page loads', () => {
    setViewport('narrow')
    renderSidebar()

    expect(document.body).toHaveFocus()
  })

  it('closes on Escape and returns focus to the toggle', async () => {
    setViewport('narrow')
    const user = userEvent.setup()
    renderSidebar()

    await user.keyboard('{Escape}')

    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
    expect(backdrop()).not.toBeInTheDocument()
    expect(toggle()).toHaveFocus()
  })

  it('closes when a link is chosen', async () => {
    setViewport('narrow')
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('link', { name: 'My Pack' }))

    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', async () => {
    setViewport('narrow')
    const user = userEvent.setup()
    renderSidebar()

    const overlay = backdrop()
    expect(overlay).not.toBeNull()
    if (overlay !== null) await user.click(overlay)

    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
  })

  it('opens again with the toggle and moves focus to the first link', async () => {
    setViewport('narrow')
    const user = userEvent.setup()
    renderSidebar()
    await user.keyboard('{Escape}')

    await user.click(toggle())

    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Breeds' })).toHaveFocus()
    expect(backdrop()).toBeInTheDocument()
  })
})
