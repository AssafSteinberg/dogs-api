import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/app/App'
import breedsFixture from './fixtures/breeds-list-all.json'

function LocationProbe() {
  const { pathname } = useLocation()
  return <p data-testid="path">{pathname}</p>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  )
}

const path = () => screen.getByTestId('path')
const heading = (name: string) => screen.getByRole('heading', { level: 1, name })

beforeEach(() => {
  // The shell loads the breed list; keep these tests offline.
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(breedsFixture), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('routes', () => {
  it('redirects / to /breeds', async () => {
    renderAt('/')

    await waitFor(() => expect(path()).toHaveTextContent(/^\/breeds$/))
    expect(heading('Breeds')).toBeInTheDocument()
  })

  it('renders the Pack page at /pack and the Wishlist page at /wishlist', () => {
    const pack = renderAt('/pack')
    expect(heading('My Pack')).toBeInTheDocument()
    expect(path()).toHaveTextContent(/^\/pack$/)
    pack.unmount()

    renderAt('/wishlist')
    expect(heading('Wishlist')).toBeInTheDocument()
    expect(path()).toHaveTextContent(/^\/wishlist$/)
  })

  it.each(['/nope', '/pack/extra', '/some/deep/unknown/path'])(
    'redirects the unknown path %s to /breeds',
    async (unknown) => {
      renderAt(unknown)

      await waitFor(() => expect(path()).toHaveTextContent(/^\/breeds$/))
      expect(heading('Breeds')).toBeInTheDocument()
    },
  )

  it.each([
    ['/breeds/hound/afghan', 'Afghan Hound'],
    ['/breeds/akita', 'Akita'],
  ])('opens the item page at %s and keeps the URL', async (deepLink, name) => {
    renderAt(deepLink)

    expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument()
    expect(path()).toHaveTextContent(deepLink)
  })

  it('shows the static 404 page at an unknown item URL and keeps the URL', async () => {
    renderAt('/breeds/hound/nothing')

    expect(await screen.findByRole('heading', { level: 1, name: '404' })).toBeInTheDocument()
    expect(screen.getByText('Page not found.')).toBeInTheDocument()
    expect(path()).toHaveTextContent('/breeds/hound/nothing')
  })
})

describe('sidebar navigation (FR-NAV-1)', () => {
  it('has links to the three pages', () => {
    renderAt('/breeds')

    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Breeds' })).toHaveAttribute('href', '/breeds')
    expect(within(nav).getByRole('link', { name: 'My Pack' })).toHaveAttribute('href', '/pack')
    expect(within(nav).getByRole('link', { name: 'Wishlist' })).toHaveAttribute('href', '/wishlist')
  })

  it.each([
    ['/breeds', 'Breeds'],
    ['/breeds/hound/afghan', 'Breeds'],
    ['/pack', 'My Pack'],
    ['/wishlist', 'Wishlist'],
  ])('at %s only the "%s" link is marked as the current page', (route, current) => {
    renderAt(route)

    const nav = screen.getByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links).toHaveLength(3)
    for (const link of links) {
      if (link.textContent === current) {
        expect(link).toHaveAttribute('aria-current', 'page')
      } else {
        expect(link).not.toHaveAttribute('aria-current')
      }
    }
  })

  it('follows a link to another page', async () => {
    const user = userEvent.setup()
    renderAt('/breeds')

    await user.click(screen.getByRole('link', { name: 'My Pack' }))

    expect(heading('My Pack')).toBeInTheDocument()
    expect(path()).toHaveTextContent(/^\/pack$/)
  })
})

describe('landmarks', () => {
  it('puts the page inside <main> next to a <nav>', () => {
    renderAt('/pack')

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(within(main).getByRole('heading', { level: 1, name: 'My Pack' })).toBeInTheDocument()
  })
})
