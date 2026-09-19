import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Contact from './Contact'
import * as inquiries from '../../api/inquiries'
import { ApiError } from '../../api/client'

vi.mock('../../api/inquiries')

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), 'Jane Doe')
  await user.type(screen.getByLabelText('Work email'), 'jane@firm.co.za')
  await user.type(screen.getByLabelText('Organization name'), 'QA Test Firm')
  await user.type(screen.getByLabelText('Message'), 'Would like a demo')
  await user.click(screen.getByRole('checkbox'))
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Contact />
    </MemoryRouter>,
  )
}

describe('Contact', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('submits a contact inquiry and shows the success state', async () => {
    vi.mocked(inquiries.submitInquiry).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    renderPage()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Send Message' }))

    await waitFor(() => expect(inquiries.submitInquiry).toHaveBeenCalledTimes(1))
    expect(inquiries.submitInquiry).toHaveBeenCalledWith({
      kind: 'contact',
      name: 'Jane Doe',
      email: 'jane@firm.co.za',
      organization_name: 'QA Test Firm',
      message: 'Would like a demo',
      consent: true,
      website: '',
    })
    expect(await screen.findByText('Message sent')).toBeInTheDocument()
  })

  it('shows an error and keeps the message when sending fails', async () => {
    vi.mocked(inquiries.submitInquiry).mockRejectedValue(new ApiError(429, 'Too many'))
    const user = userEvent.setup()
    renderPage()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Send Message' }))

    expect(await screen.findByText('Too many requests. Please try again later.')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toHaveValue('Would like a demo')
  })

  it('does not submit without a message', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Send Message' }))
    expect(await screen.findByText('Tell us how we can help.')).toBeInTheDocument()
    expect(inquiries.submitInquiry).not.toHaveBeenCalled()
  })
})
