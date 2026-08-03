import { apiRequest } from './client'

export interface Client {
  id: string
  firm_id: string
  company_name: string
  is_active: boolean
}

export async function listClients(token: string): Promise<Client[]> {
  return apiRequest<Client[]>('/clients', { token })
}

export async function createClient(token: string, companyName: string): Promise<Client> {
  return apiRequest<Client>('/clients', { method: 'POST', body: { company_name: companyName }, token })
}

export interface Contact {
  id: string
  client_id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  invitation_status: string
  last_login: string | null
}

export async function inviteContact(
  token: string,
  clientId: string,
  body: { first_name: string; last_name: string; email: string },
): Promise<Contact> {
  return apiRequest<Contact>(`/clients/${clientId}/contacts`, { method: 'POST', body, token })
}

export async function resendInvite(token: string, email: string): Promise<void> {
  await apiRequest('/clients/contacts/resend-invite', { method: 'POST', body: { email }, token })
}
