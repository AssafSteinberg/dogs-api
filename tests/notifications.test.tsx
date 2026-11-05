import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toast } from '../src/components/Toast'
import {
  NotificationsProvider,
  useNotify,
  type NotificationSource,
} from '../src/state/notifications'

function Controls({ message, source }: { message: string; source: NotificationSource }) {
  const { notify } = useNotify()
  return <button onClick={() => notify(message, source)}>{`show ${message}`}</button>
}

function ClearButtons() {
  const { clear } = useNotify()
  return (
    <>
      <button onClick={() => clear('api')}>clear api</button>
      <button onClick={() => clear('route')}>clear route</button>
    </>
  )
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
    renderToast(<Controls message="Can't reach the dog.ceo API" source="api" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show/ }))

    expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the dog.ceo API")
  })

  it('shows one pop-up when the same message is raised twice', async () => {
    const user = userEvent.setup()
    renderToast(<Controls message="Can't reach the dog.ceo API" source="api" />)

    await user.click(screen.getByRole('button', { name: /show/ }))
    await user.click(screen.getByRole('button', { name: /show/ }))

    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('shows different messages as separate pop-ups', async () => {
    const user = userEvent.setup()
    renderToast(
      <>
        <Controls message="first problem" source="api" />
        <Controls message="second problem" source="route" />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'show first problem' }))
    await user.click(screen.getByRole('button', { name: 'show second problem' }))

    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })

  it('removes a pop-up with its dismiss button', async () => {
    const user = userEvent.setup()
    renderToast(<Controls message="Can't reach the dog.ceo API" source="api" />)
    await user.click(screen.getByRole('button', { name: /show/ }))

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('clear by source', () => {
  it('clears api pop-ups without touching route pop-ups, and the other way round', async () => {
    const user = userEvent.setup()
    renderToast(
      <>
        <Controls message="api problem" source="api" />
        <Controls message="route problem" source="route" />
        <ClearButtons />
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'show api problem' }))
    await user.click(screen.getByRole('button', { name: 'show route problem' }))

    await user.click(screen.getByRole('button', { name: 'clear api' }))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('route problem')

    await user.click(screen.getByRole('button', { name: 'clear route' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does nothing when there is nothing to clear', async () => {
    const user = userEvent.setup()
    renderToast(<ClearButtons />)

    await user.click(screen.getByRole('button', { name: 'clear api' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('useNotify', () => {
  it('returns stable functions, so using them in an effect does not loop', () => {
    const { result, rerender } = renderHook(() => useNotify(), { wrapper: NotificationsProvider })
    const before = result.current

    act(() => {
      result.current.notify('something went wrong', 'api')
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
