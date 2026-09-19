import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Register from './Register'
import * as inquiries from '../../api/inquiries'
import { ApiError } from '../../api/client'

vi.mock('../../api/inquiries')

function renderPage() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  )
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Your name'), 'Jane Doe')
  await user.type(screen.getByLabelText('Work email'), 'jane@firm.co.za')
  await user.type(screen.getByLabelText('Firm / organization name'), 'QA Test Firm')
  await user.click(screen.getByLabelText(/I agree to be contacted/))
}

describe('Register (request access)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('submits an access_request payload with consent and an empty honeypot', async () => {
    vi.mocked(inquiries.submitInquiry).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    renderPage()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Request access' }))

    await waitFor(() => expect(inquiries.submitInquiry).toHaveBeenCalledTimes(1))
    expect(inquiries.submitInquiry).toHaveBeenCalledWith({
      kind: 'access_request',
      name: 'Jane Doe',
      email: 'jane@firm.co.za',
      phone: undefined,
      organization_name: 'QA Test Firm',
      message: undefined,
      consent: true,
      website: '',
    })
    expect(await screen.findByText('Request received')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
  })

  it('flags missing required fields and does not submit', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Request access' }))

    expect(await screen.findByText(/Enter your name/)).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your firm or organization name.')).toBeInTheDocument()
    expect(screen.getByText('Please confirm you agree to be contacted.')).toBeInTheDocument()
    expect(screen.getByLabelText('Your name')).toHaveAttribute('aria-invalid', 'true')
    expect(inquiries.submitInquiry).not.toHaveBeenCalled()
  })

  it('shows a friendly message on rate limiting and keeps the values', async () => {
    vi.mocked(inquiries.submitInquiry).mockRejectedValue(new ApiError(429, 'Too many'))
    const user = userEvent.setup()
    renderPage()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Request access' }))

    expect(await screen.findByText('Too many requests. Please try again later.')).toBeInTheDocument()
    expect(screen.getByLabelText('Your name')).toHaveValue('Jane Doe')
    expect(screen.getByLabelText('Firm / organization name')).toHaveValue('QA Test Firm')
  })

  it('shows a retry message on network errors', async () => {
    vi.mocked(inquiries.submitInquiry).mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    renderPage()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Request access' }))
    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument()
  })

  it('keeps the honeypot out of the tab order and hidden from assistive tech', async () => {
    const user = userEvent.setup()
    const { container } = renderPage()
    const honeypot = container.querySelector('input[name="website"]') as HTMLInputElement
    expect(honeypot).toHaveAttribute('tabindex', '-1')
    expect(honeypot).toHaveAttribute('autocomplete', 'off')
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull()

    const stops = new Set<Element | null>()
    for (let i = 0; i < 20; i++) {
      await user.tab()
      stops.add(document.activeElement)
    }
    expect(stops.has(honeypot)).toBe(false)
  })
})
