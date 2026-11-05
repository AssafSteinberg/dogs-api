import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toast } from '../src/components/Toast'
import { NotificationsProvider, useNotify } from '../src/state/notifications'

function Controls({ message }: { message: string }) {
  const { notify } = useNotify()
  return <button onClick={() => notify(message)}>{`show ${message}`}</button>
}

function ClearButton() {
  const { clear } = useNotify()
  return <button onClick={() => clear()}>clear all</button>
}

function renderToast(children: React.ReactNode) {
  return render(
    <NotificationsProvider>
      <Toast />
      {children}
    </NotificationsProvider>,
  )
}

describe('notify and Toast (FR-D-9)', () => {
  it('shows the message in an alert', async () => {
    const user = userEvent.setup()
    renderToast(<Controls message="Can't reach the dog.ceo API" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show/ }))

    expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the dog.ceo API")
  })

  it('shows one pop-up when the same message is raised twice', async () => {
    const user = userEvent.setup()
    renderToast(<Controls message="Can't reach the dog.ceo API" />)

    await user.click(screen.getByRole('button', { name: /show/ }))
    await user.click(screen.getByRole('button', { name: /show/ }))

    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('shows different messages as separate pop-ups', async () => {
    const user = userEvent.setup()
    renderToast(
      <>
        <Controls message="first problem" />
        <Controls message="second problem" />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'show first problem' }))
    await user.click(screen.getByRole('button', { name: 'show second problem' }))

    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })

  it('removes a pop-up with its dismiss button', async () => {
    const user = userEvent.setup()
    renderToast(<Controls message="Can't reach the dog.ceo API" />)
    await user.click(screen.getByRole('button', { name: /show/ }))

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('clear (a later API call succeeded)', () => {
  it('removes every pop-up', async () => {
    const user = userEvent.setup()
    renderToast(
      <>
        <Controls message="first problem" />
        <Controls message="second problem" />
        <ClearButton />
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'show first problem' }))
    await user.click(screen.getByRole('button', { name: 'show second problem' }))
    expect(screen.getAllByRole('alert')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'clear all' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does nothing when there is nothing to clear', async () => {
    const user = userEvent.setup()
    renderToast(<ClearButton />)

    await user.click(screen.getByRole('button', { name: 'clear all' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lets the same message be shown again afterwards', async () => {
    const user = userEvent.setup()
    renderToast(
      <>
        <Controls message="problem" />
        <ClearButton />
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'show problem' }))
    await user.click(screen.getByRole('button', { name: 'clear all' }))

    await user.click(screen.getByRole('button', { name: 'show problem' }))

    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})

describe('useNotify', () => {
  it('returns stable functions, so using them in an effect does not loop', () => {
    const { result, rerender } = renderHook(() => useNotify(), { wrapper: NotificationsProvider })
    const before = result.current

    act(() => {
      result.current.notify('something went wrong')
    })
    rerender()

    expect(result.current.notify).toBe(before.notify)
    expect(result.current.dismiss).toBe(before.dismiss)
    expect(result.current.clear).toBe(before.clear)
  })

  it('throws a clear error outside a NotificationsProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useNotify())).toThrow(/NotificationsProvider/)

    vi.restoreAllMocks()
  })
})
