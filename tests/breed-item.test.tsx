import type { ComponentProps, ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { toLeafId } from '../src/domain/leaf'
import { BreedItem } from '../src/features/breeds/BreedItem'
import { detailsId } from '../src/features/breeds/detailsId'

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
  expanded: false,
  wishlisted: false,
  onToggle: () => {},
}

const akita: Props = {
  id: toLeafId('akita', null),
  breed: 'akita',
  sub: null,
  expanded: false,
  wishlisted: false,
  onToggle: () => {},
}

function renderItem(props: Props, children?: ReactNode) {
  return render(
    <ul>
      <BreedItem {...props}>{children}</BreedItem>
    </ul>,
  )
}

describe('BreedItem name and breed tag (FR-M-2)', () => {
  it('shows a sub-breed with its name and its breed as a tag', () => {
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

describe('BreedItem toggle (FR-D-7)', () => {
  it('is a button whose aria-expanded follows the expanded prop', () => {
    const { rerender } = renderItem(afghan)
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')

    rerender(
      <ul>
        <BreedItem {...afghan} expanded />
      </ul>,
    )

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  })

  it('controls the details region of its own leaf', () => {
    renderItem(afghan)

    expect(screen.getByRole('button')).toHaveAttribute('aria-controls', detailsId(afghan.id))
    expect(detailsId(afghan.id)).not.toBe(detailsId(akita.id))
    expect(detailsId(afghan.id)).not.toMatch(/[\s/]/)
  })

  it('calls onToggle with its id when clicked', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    renderItem({ ...afghan, onToggle })

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith('hound/afghan')
  })

  it.each([['{Enter}'], [' ']])('toggles from the keyboard with %j', async (key) => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    renderItem({ ...akita, onToggle })

    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await user.keyboard(key)

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith('akita')
  })
})

describe('BreedItem wishlist marker (FR-W-4)', () => {
  it('shows a marker when the leaf is on the wishlist', () => {
    renderItem({ ...afghan, wishlisted: true })

    expect(screen.getByText('On wishlist')).toBeInTheDocument()
  })

  it('shows no marker otherwise', () => {
    renderItem(afghan)

    expect(screen.queryByText('On wishlist')).not.toBeInTheDocument()
  })
})

describe('BreedItem details slot and memoisation', () => {
  it('shows the details it is given below the toggle', () => {
    renderItem({ ...afghan, expanded: true }, <p>details here</p>)

    expect(screen.getByText('details here')).toBeInTheDocument()
  })

  it('does not re-render when its parent re-renders with the same props', () => {
    const onToggle = () => {}
    const props = { ...afghan, onToggle }
    const { rerender } = render(
      <ul>
        <BreedItem {...props} />
      </ul>,
    )
    const rendersAfterMount = tagRenders.count

    rerender(
      <ul>
        <BreedItem {...props} />
      </ul>,
    )
    rerender(
      <ul>
        <BreedItem {...props} />
      </ul>,
    )

    expect(tagRenders.count).toBe(rendersAfterMount)
  })

  it('does re-render when one of its props changes (so the check above can fail)', () => {
    const onToggle = () => {}
    const props = { ...afghan, onToggle }
    const { rerender } = render(
      <ul>
        <BreedItem {...props} />
      </ul>,
    )
    const rendersAfterMount = tagRenders.count

    rerender(
      <ul>
        <BreedItem {...props} expanded />
      </ul>,
    )

    expect(tagRenders.count).toBeGreaterThan(rendersAfterMount)
  })
})
