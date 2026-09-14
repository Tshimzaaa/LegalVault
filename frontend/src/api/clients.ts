import { apiRequest } from './client'

export interface Client {
  id: string
  org_id: string
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

export async function listContacts(token: string, clientId: string): Promise<Contact[]> {
  return apiRequest<Contact[]>(`/clients/${clientId}/contacts`, { token })
}

export async function updateClientStatus(token: string, clientId: string, isActive: boolean): Promise<Client> {
  return apiRequest<Client>(`/clients/${clientId}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
    token,
  })
}

export async function deleteClient(token: string, clientId: string): Promise<void> {
  await apiRequest(`/clients/${clientId}`, { method: 'DELETE', token })
}

export async function updateContactStatus(
  token: string,
  clientId: string,
  contactId: string,
  isActive: boolean,
): Promise<Contact> {
  return apiRequest<Contact>(`/clients/${clientId}/contacts/${contactId}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
    token,
  })
}

export async function deleteContact(token: string, clientId: string, contactId: string): Promise<void> {
  await apiRequest(`/clients/${clientId}/contacts/${contactId}`, { method: 'DELETE', token })
}

export async function forceLogoutContact(token: string, clientId: string, contactId: string): Promise<Contact> {
  return apiRequest<Contact>(`/clients/${clientId}/contacts/${contactId}/force-logout`, { method: 'POST', token })
}
