import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Staff from './Staff'
import * as authApi from '../../api/auth'
import type { User } from '../../api/auth'

vi.mock('../../api/auth')

const admin: User = {
  id: 'admin-1',
  org_id: 'org-1',
  first_name: 'Ada',
  last_name: 'Admin',
  email: 'ada@example.com',
  role: 'admin',
  is_active: true,
  invitation_status: 'accepted',
  last_login: null,
}

const lawyer: User = {
  id: 'lawyer-1',
  org_id: 'org-1',
  first_name: 'Lou',
  last_name: 'Lawyer',
  email: 'lou@example.com',
  role: 'lawyer',
  is_active: true,
  invitation_status: 'accepted',
  last_login: null,
}

describe('Staff page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('access_token', 'token-a')
    vi.mocked(authApi.listUsers).mockResolvedValue([admin, lawyer])
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('lists staff for an admin', async () => {
    render(<Staff user={admin} />)

    expect(await screen.findByText('Lou Lawyer')).toBeInTheDocument()
    expect(screen.getByText('Ada Admin')).toBeInTheDocument()
  })

  it('blocks non-admins from managing staff', async () => {
    const nonAdmin = { ...lawyer }
    render(<Staff user={nonAdmin} />)

    // The component fetches staff regardless of role — it's the render, not the
    // fetch, that's gated — so only the message is asserted here.
    expect(await screen.findByText(/only org admins can manage staff/i)).toBeInTheDocument()
    expect(screen.queryByText('Lou Lawyer')).not.toBeInTheDocument()
  })

  it('invites a new staff member and shows the copyable invite link', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.inviteStaff).mockResolvedValue({
      id: 'new-1',
      org_id: 'org-1',
      first_name: 'New',
      last_name: 'Hire',
      email: 'new@example.com',
      role: 'lawyer',
      is_active: true,
      invitation_status: 'pending',
      last_login: null,
      invitation_token: 'abc123',
    })

    render(<Staff user={admin} />)
    await screen.findByText('Lou Lawyer')

    await user.click(screen.getByRole('button', { name: /invite staff/i }))
    await user.type(screen.getByLabelText('First name'), 'New')
    await user.type(screen.getByLabelText('Last name'), 'Hire')
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: /send invite/i }))

    await waitFor(() => expect(authApi.inviteStaff).toHaveBeenCalledWith('token-a', expect.objectContaining({
      first_name: 'New',
      last_name: 'Hire',
      email: 'new@example.com',
    })))
    expect(await screen.findByDisplayValue(/abc123/)).toBeInTheDocument()
  })

  it('deactivates an active staff member after confirmation', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(authApi.updateStaffStatus).mockResolvedValue({ ...lawyer, is_active: false })

    render(<Staff user={admin} />)
    const row = (await screen.findByText('Lou Lawyer')).closest('tr')!

    await user.click(within(row).getByRole('button', { name: /deactivate/i }))

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => expect(authApi.updateStaffStatus).toHaveBeenCalledWith('token-a', 'lawyer-1', false))
  })

  it('skips deactivation when the confirmation is declined', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<Staff user={admin} />)
    const row = (await screen.findByText('Lou Lawyer')).closest('tr')!

    await user.click(within(row).getByRole('button', { name: /deactivate/i }))

    expect(authApi.updateStaffStatus).not.toHaveBeenCalled()
  })

  it('force-logs-out a staff member after confirmation', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(authApi.forceLogoutStaff).mockResolvedValue(undefined)

    render(<Staff user={admin} />)
    const row = (await screen.findByText('Lou Lawyer')).closest('tr')!

    await user.click(within(row).getByRole('button', { name: /force logout/i }))

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => expect(authApi.forceLogoutStaff).toHaveBeenCalledWith('token-a', 'lawyer-1'))
  })

  it('skips force-logout when the confirmation is declined', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<Staff user={admin} />)
    const row = (await screen.findByText('Lou Lawyer')).closest('tr')!

    await user.click(within(row).getByRole('button', { name: /force logout/i }))

    expect(authApi.forceLogoutStaff).not.toHaveBeenCalled()
  })
})
