import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Templates from './Templates'
import * as templatesApi from '../../api/templates'
import type { Template } from '../../api/templates'

vi.mock('../../api/templates')

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 't1',
    org_id: 'org-1',
    title: 'Mutual NDA',
    description: 'Standard mutual NDA',
    category: 'Confidentiality',
    original_filename: 'nda.pdf',
    content_type: 'application/pdf',
    version: 1,
    body: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('Templates page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('access_token', 'token-a')
    vi.mocked(templatesApi.listTemplates).mockResolvedValue([makeTemplate()])
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('lists templates from the backend', async () => {
    render(<Templates />)

    expect(await screen.findByText('Mutual NDA')).toBeInTheDocument()
    expect(screen.getByText(/Confidentiality/)).toBeInTheDocument()
  })

  it('downloads a template via a signed URL', async () => {
    const user = userEvent.setup()
    vi.mocked(templatesApi.downloadTemplate).mockResolvedValue({
      download_url: 'https://example.com/signed',
      expires_in_seconds: 3600,
    })
    vi.stubGlobal('open', vi.fn())

    render(<Templates />)
    await screen.findByText('Mutual NDA')

    await user.click(screen.getByRole('button', { name: /use template/i }))

    await waitFor(() => expect(templatesApi.downloadTemplate).toHaveBeenCalledWith('token-a', 't1'))
    expect(window.open).toHaveBeenCalledWith('https://example.com/signed', '_blank', 'noopener,noreferrer')
  })

  it('edits a template', async () => {
    const user = userEvent.setup()
    vi.mocked(templatesApi.updateTemplate).mockResolvedValue(makeTemplate({ title: 'Mutual NDA v2' }))

    render(<Templates />)
    await screen.findByText('Mutual NDA')

    await user.click(screen.getByRole('button', { name: /edit mutual nda/i }))
    const titleInput = screen.getByDisplayValue('Mutual NDA')
    await user.clear(titleInput)
    await user.type(titleInput, 'Mutual NDA v2')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(templatesApi.updateTemplate).toHaveBeenCalledWith(
        'token-a',
        't1',
        expect.objectContaining({ title: 'Mutual NDA v2' }),
      ),
    )
    expect(await screen.findByText('Mutual NDA v2')).toBeInTheDocument()
  })

  it('deletes a template after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(templatesApi.deleteTemplate).mockResolvedValue(undefined)

    render(<Templates />)
    await screen.findByText('Mutual NDA')

    await user.click(screen.getByRole('button', { name: /delete mutual nda/i }))

    await waitFor(() => expect(templatesApi.deleteTemplate).toHaveBeenCalledWith('token-a', 't1'))
    await waitFor(() => expect(screen.queryByText('Mutual NDA')).not.toBeInTheDocument())
  })

  it('does not delete when the confirmation is declined', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<Templates />)
    await screen.findByText('Mutual NDA')

    await user.click(screen.getByRole('button', { name: /delete mutual nda/i }))

    expect(templatesApi.deleteTemplate).not.toHaveBeenCalled()
    expect(screen.getByText('Mutual NDA')).toBeInTheDocument()
  })

  it('uploads a new template', async () => {
    const user = userEvent.setup()
    vi.mocked(templatesApi.uploadTemplate).mockResolvedValue(makeTemplate({ id: 't2', title: 'Consultancy Agreement' }))

    render(<Templates />)
    await screen.findByText('Mutual NDA')

    await user.click(screen.getByRole('button', { name: /upload template/i }))
    await user.type(screen.getByPlaceholderText('Mutual NDA…'), 'Consultancy Agreement')
    await user.type(screen.getByPlaceholderText('Confidentiality…'), 'Consultancy')
    const file = new File(['content'], 'agreement.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByLabelText(/file \(pdf, word, or text/i) as HTMLInputElement
    await user.upload(fileInput, file)

    await user.click(screen.getByRole('button', { name: /^upload$/i }))

    await waitFor(() =>
      expect(templatesApi.uploadTemplate).toHaveBeenCalledWith(
        'token-a',
        expect.objectContaining({ title: 'Consultancy Agreement', category: 'Consultancy' }),
      ),
    )
  })
})
