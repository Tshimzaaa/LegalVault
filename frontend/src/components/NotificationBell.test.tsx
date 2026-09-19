import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import * as notificationsApi from '../api/notifications'
import type { Notification } from '../api/notifications'

vi.mock('../api/notifications')

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

function renderBell() {
  return render(
    <MemoryRouter initialEntries={['/staff/dashboard']}>
      <NotificationBell />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    type: 'contract.new_message',
    title: 'New message',
    body: 'Something happened',
    target_type: 'contract',
    target_id: 'm1',
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('NotificationBell', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'token-a')
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(0)
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue([])
    vi.mocked(notificationsApi.markNotificationRead).mockImplementation(async (_t, id) =>
      makeNotification({ id, is_read: true }),
    )
    vi.mocked(notificationsApi.markAllNotificationsRead).mockResolvedValue(undefined)
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows the unread badge from the initial poll', async () => {
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(3)

    renderBell()

    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(notificationsApi.getUnreadCount).toHaveBeenCalledWith('token-a')
  })

  it('hides the badge when there are no unread notifications', async () => {
    renderBell()

    await waitFor(() => expect(notificationsApi.getUnreadCount).toHaveBeenCalled())
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('regression: reads the token fresh on every poll instead of the one from mount', async () => {
    // This is the exact bug fixed this session — the poll loop used to capture
    // localStorage's token once at mount and never re-read it, so once that
    // token expired every subsequent poll needed a wasted refresh round trip.
    vi.useFakeTimers()

    renderBell()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(notificationsApi.getUnreadCount).toHaveBeenLastCalledWith('token-a')

    localStorage.setItem('access_token', 'token-b')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(notificationsApi.getUnreadCount).toHaveBeenLastCalledWith('token-b')
  })

  it('opens the panel, lists notifications, and marks one read on click', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(1)
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue([makeNotification()])

    renderBell()
    await screen.findByText('1')

    await user.click(screen.getByRole('button', { name: /notifications/i }))

    expect(await screen.findByText('New message')).toBeInTheDocument()

    await user.click(screen.getByText('New message'))

    await waitFor(() =>
      expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('token-a', 'n1'),
    )
  })

  it('opens the related contract when a contract notification is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(1)
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue([makeNotification()])

    renderBell()
    await screen.findByText('1')
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await user.click(await screen.findByText('New message'))

    expect(screen.getByTestId('location')).toHaveTextContent('/staff/contracts/m1')
    await waitFor(() =>
      expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('token-a', 'n1'),
    )
    expect(screen.queryByRole('dialog', { name: /notifications/i })).not.toBeInTheDocument()
  })

  it('only marks read, without navigating, when a notification has no target', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(1)
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue([
      makeNotification({ target_type: null, target_id: null }),
    ])

    renderBell()
    await screen.findByText('1')
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await user.click(await screen.findByText('New message'))

    expect(screen.getByTestId('location')).toHaveTextContent('/staff/dashboard')
    await waitFor(() =>
      expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('token-a', 'n1'),
    )
  })

  it('marks all notifications read and clears the badge', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(2)
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue([
      makeNotification({ id: 'n1' }),
      makeNotification({ id: 'n2' }),
    ])

    renderBell()
    await screen.findByText('2')

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await screen.findAllByText('New message')

    await user.click(screen.getByText('Mark All Read'))

    await waitFor(() => expect(notificationsApi.markAllNotificationsRead).toHaveBeenCalledWith('token-a'))
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })
})
