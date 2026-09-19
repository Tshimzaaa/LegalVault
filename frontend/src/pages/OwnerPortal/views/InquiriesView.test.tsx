import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import InquiriesView from './InquiriesView'
import { OwnerDataProvider } from '../OwnerDataContext'
import * as ownerApi from '../../../api/owner'
import type { Inquiry } from '../../../api/owner'

vi.mock('../../../api/owner')

function LocationProbe() {
  const loc = useLocation()
  return <span data-testid="location">{loc.pathname + loc.search}</span>
}

function makeInquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: 'i1',
    kind: 'access_request',
    status: 'new',
    name: 'Jane Doe',
    email: 'jane@doelaw.test',
    phone: '+267 71 000 000',
    organization_name: 'Doe & Partners',
    message: 'We would like access for our firm.',
    owner_note: null,
    handled_at: null,
    organization_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

const contact = makeInquiry({
  id: 'i2',
  kind: 'contact',
  name: 'Sam Visitor',
  email: 'sam@example.test',
  phone: null,
  organization_name: null,
  message: 'Do you support e-signatures?',
})

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/owner/inquiries']}>
      <OwnerDataProvider>
        <Routes>
          <Route path="/owner/inquiries/:id?" element={<InquiriesView />} />
        </Routes>
        <LocationProbe />
      </OwnerDataProvider>
    </MemoryRouter>,
  )
}

describe('Owner inquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('access_token', 'owner-token')
    vi.mocked(ownerApi.listOrganizations).mockResolvedValue([])
    vi.mocked(ownerApi.getOrganization).mockReset()
    vi.mocked(ownerApi.getPlatformMetrics).mockRejectedValue(new Error('unused'))
    vi.mocked(ownerApi.getSystemHealth).mockRejectedValue(new Error('unused'))
    vi.mocked(ownerApi.getInquirySummary).mockResolvedValue({
      new: 2,
      in_progress: 0,
      onboarded: 1,
      closed: 0,
      new_access_requests: 1,
      new_contact: 1,
    })
    vi.mocked(ownerApi.listInquiries).mockResolvedValue({ items: [makeInquiry(), contact], total: 2 })
    vi.mocked(ownerApi.updateInquiry).mockImplementation(async (_t, id, patch) => ({
      ...(id === 'i1' ? makeInquiry() : contact),
      ...patch,
    }) as Inquiry)
    vi.mocked(ownerApi.deleteInquiry).mockResolvedValue(undefined)
    vi.mocked(ownerApi.createOrganization).mockResolvedValue({ message: 'ok', organization_id: 'org-9', user_id: 'u-1' })
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('loads the newest inquiries and shows counts on the filter chips', async () => {
    renderView()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(ownerApi.listInquiries).toHaveBeenCalledWith('owner-token', {
      status: undefined,
      kind: undefined,
      limit: 50,
      offset: 0,
    })
    const newChip = await screen.findByRole('button', { name: /^New\s*2$/ })
    expect(newChip).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /^All\s*3$/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('passes the status and kind filters to the API', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByText('Jane Doe')

    await user.click(screen.getByRole('button', { name: /^New/ }))
    await waitFor(() =>
      expect(ownerApi.listInquiries).toHaveBeenLastCalledWith('owner-token', {
        status: 'new',
        kind: undefined,
        limit: 50,
        offset: 0,
      }),
    )
    expect(screen.getByTestId('location')).toHaveTextContent('status=new')

    await user.selectOptions(screen.getByRole('combobox', { name: /filter by type/i }), 'access_request')
    await waitFor(() =>
      expect(ownerApi.listInquiries).toHaveBeenLastCalledWith('owner-token', {
        status: 'new',
        kind: 'access_request',
        limit: 50,
        offset: 0,
      }),
    )
  })

  it('opens a detail view with mailto and tel links', async () => {
    const user = userEvent.setup()
    renderView()

    await user.click(await screen.findByRole('link', { name: /Jane Doe/ }))

    expect(screen.getByTestId('location')).toHaveTextContent('/owner/inquiries/i1')
    const detail = await screen.findByRole('article')
    expect(within(detail).getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument()
    expect(within(detail).getByRole('link', { name: 'jane@doelaw.test' })).toHaveAttribute('href', 'mailto:jane@doelaw.test')
    expect(within(detail).getByRole('link', { name: '+267 71 000 000' })).toHaveAttribute('href', 'tel:+26771000000')
    expect(within(detail).getByText('We would like access for our firm.')).toBeInTheDocument()
    expect(within(detail).getByRole('link', { name: /reply by email/i }).getAttribute('href')).toMatch(/^mailto:jane@doelaw\.test\?subject=/)
  })

  it('saves the owner note explicitly', async () => {
    const user = userEvent.setup()
    renderView()
    await user.click(await screen.findByRole('link', { name: /Jane Doe/ }))

    const save = await screen.findByRole('button', { name: 'Save note' })
    expect(save).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: /owner note/i }), 'Called, will onboard Monday')
    expect(ownerApi.updateInquiry).not.toHaveBeenCalled()
    await user.click(save)

    await waitFor(() =>
      expect(ownerApi.updateInquiry).toHaveBeenCalledWith('owner-token', 'i1', { owner_note: 'Called, will onboard Monday' }),
    )
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('marks an inquiry closed and rolls back when the request fails', async () => {
    const user = userEvent.setup()
    renderView()
    await user.click(await screen.findByRole('link', { name: /Jane Doe/ }))

    await user.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(ownerApi.updateInquiry).toHaveBeenCalledWith('owner-token', 'i1', { status: 'closed' }))
    expect(await screen.findByRole('button', { name: 'Reopen' })).toBeInTheDocument()

    vi.mocked(ownerApi.updateInquiry).mockRejectedValueOnce(new Error('Server said no'))
    await user.click(screen.getByRole('button', { name: 'Reopen' }))
    expect(await screen.findByText('Server said no')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeInTheDocument()
  })

  it('onboards a firm from an access request with a prefilled form', async () => {
    const user = userEvent.setup()
    renderView()
    await user.click(await screen.findByRole('link', { name: /Jane Doe/ }))

    await user.click(await screen.findByRole('button', { name: 'Onboard this firm' }))

    const dialog = await screen.findByRole('dialog', { name: /onboard this firm/i })
    expect(within(dialog).getByLabelText('Organization name')).toHaveValue('Doe & Partners')
    expect(within(dialog).getByLabelText('Admin first name')).toHaveValue('Jane')
    expect(within(dialog).getByLabelText('Admin last name')).toHaveValue('Doe')
    expect(within(dialog).getByLabelText('Admin email')).toHaveValue('jane@doelaw.test')
    expect(within(dialog).getByLabelText('Organization phone (optional)')).toHaveValue('+267 71 000 000')
    expect((within(dialog).getByLabelText('Admin password') as HTMLInputElement).value).toHaveLength(16)

    await user.click(within(dialog).getByRole('button', { name: /create organization/i }))

    await waitFor(() =>
      expect(ownerApi.createOrganization).toHaveBeenCalledWith(
        'owner-token',
        expect.objectContaining({
          organization: expect.objectContaining({ name: 'Doe & Partners', email: 'jane@doelaw.test' }),
          admin: expect.objectContaining({ first_name: 'Jane', last_name: 'Doe', email: 'jane@doelaw.test' }),
        }),
      ),
    )
    await waitFor(() =>
      expect(ownerApi.updateInquiry).toHaveBeenCalledWith('owner-token', 'i1', {
        status: 'onboarded',
        organization_id: 'org-9',
      }),
    )
    expect(await screen.findByText('Share these details with the client')).toBeInTheDocument()
    expect(screen.getByText(/shown only now/i)).toBeInTheDocument()
  })

  it('does not create an organization when the password is too short', async () => {
    const user = userEvent.setup()
    renderView()
    await user.click(await screen.findByRole('link', { name: /Jane Doe/ }))
    await user.click(await screen.findByRole('button', { name: 'Onboard this firm' }))
    const dialog = await screen.findByRole('dialog')

    const password = within(dialog).getByLabelText('Admin password')
    await user.clear(password)
    await user.type(password, 'short')
    await user.click(within(dialog).getByRole('button', { name: /create organization/i }))

    expect(await within(dialog).findByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(ownerApi.createOrganization).not.toHaveBeenCalled()
  })

  it('deletes an inquiry only after confirmation', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderView()
    await user.click(await screen.findByRole('link', { name: /Sam Visitor/ }))

    await user.click(await screen.findByRole('button', { name: /delete/i }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(ownerApi.deleteInquiry).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(ownerApi.deleteInquiry).toHaveBeenCalledWith('owner-token', 'i2'))
    await waitFor(() => expect(screen.queryByRole('link', { name: /Sam Visitor/ })).not.toBeInTheDocument())
    expect(screen.getByTestId('location')).toHaveTextContent('/owner/inquiries')
  })
})
