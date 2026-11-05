import type { ComponentProps, ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { toLeafId } from '../src/domain/leaf'
import { BreedItem } from '../src/features/breeds/BreedItem'

// Counts renders of Tag, which BreedItem renders for a sub-breed: Tag can only render when BreedItem does.
const tagRenders = vi.hoisted(() => ({ count: 0 }))
vi.mock('../src/components/Tag', async () => {
  const { createElement } = await import('react')
  return {
    Tag: ({ children }: { children: ReactNode }) => {
      tagRenders.count += 1
      return createElement('span', null, children)
    },
  }
})

type Props = ComponentProps<typeof BreedItem>

const afghan: Props = {
  id: toLeafId('hound', 'afghan'),
  breed: 'hound',
  sub: 'afghan',
  wishlisted: false,
}

const akita: Props = {
  id: toLeafId('akita', null),
  breed: 'akita',
  sub: null,
  wishlisted: false,
}

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <p data-testid="url">{pathname + search}</p>
}

function Rows({ props }: { props: Props }) {
  return (
    <MemoryRouter initialEntries={['/breeds?q=ha&sort=desc']}>
      <ul>
        <BreedItem {...props} />
      </ul>
      <LocationProbe />
    </MemoryRouter>
  )
}

function renderItem(props: Props) {
  return render(<Rows props={props} />)
}

describe('BreedItem name and breed tag (FR-M-2)', () => {
  it('shows a sub-breed with its full name and its breed as a tag', () => {
    renderItem(afghan)

    const row = screen.getByRole('listitem')
    // The full name, "Afghan Hound", and the unchanged breed tag, "Hound".
    expect(within(row).getByText('Afghan Hound')).toBeInTheDocument()
    expect(within(row).getByText('Hound')).toBeInTheDocument()
  })

  it('shows a breed without sub-breeds with its name and no tag', () => {
    renderItem(akita)

    const row = screen.getByRole('listitem')
    expect(within(row).getByText('Akita')).toBeInTheDocument()
    expect(row).toHaveTextContent(/^Akita$/)
  })
})

describe('BreedItem is a link to the element\'s page (FR-D-1)', () => {
  it('links a sub-breed to /breeds/<breed>/<sub>', () => {
    renderItem(afghan)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/breeds/hound/afghan')
    expect(link).toHaveAccessibleName(/^Afghan Hound/)
  })

  it('links a breed without sub-breeds to /breeds/<breed>', () => {
    renderItem(akita)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/breeds/akita')
  })

  it('does not carry the list\'s filter and order in the link', () => {
    renderItem(afghan)

    expect(screen.getByRole('link').getAttribute('href')).not.toContain('?')
  })

  it('is only a link: no button, and nothing that expands', () => {
    renderItem(afghan)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('listitem').querySelector('[aria-expanded]')).toBeNull()
    expect(screen.getByRole('listitem').querySelector('[aria-controls]')).toBeNull()
  })

  it('opens the page when clicked', async () => {
    const user = userEvent.setup()
    renderItem(afghan)

    await user.click(screen.getByRole('link'))

    expect(screen.getByTestId('url')).toHaveTextContent(/^\/breeds\/hound\/afghan$/)
  })

  it('opens the page from the keyboard with Enter (FR-D-7)', async () => {
    const user = userEvent.setup()
    renderItem(akita)

    await user.tab()
    expect(screen.getByRole('link')).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.getByTestId('url')).toHaveTextContent(/^\/breeds\/akita$/)
  })
})

describe('BreedItem wishlist marker (FR-W-4)', () => {
  it('shows a marker when the leaf is on the wishlist', () => {
    renderItem({ ...afghan, wishlisted: true })

    expect(screen.getByText('On wishlist')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAccessibleName(/On wishlist/)
  })

  it('shows no marker otherwise', () => {
    renderItem(afghan)

    expect(screen.queryByText('On wishlist')).not.toBeInTheDocument()
  })
})

describe('BreedItem memoisation', () => {
  it('does not re-render when its parent re-renders with the same props', () => {
    const { rerender } = render(<Rows props={afghan} />)
    const rendersAfterMount = tagRenders.count

    rerender(<Rows props={afghan} />)
    rerender(<Rows props={afghan} />)

    expect(tagRenders.count).toBe(rendersAfterMount)
  })

  it('does re-render when one of its props changes (so the check above can fail)', () => {
    const { rerender } = render(<Rows props={afghan} />)
    const rendersAfterMount = tagRenders.count

    rerender(<Rows props={{ ...afghan, wishlisted: true }} />)

    expect(tagRenders.count).toBeGreaterThan(rendersAfterMount)
  })
})
