import { apiRequest } from './client'

export interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface AiConversationSummary {
  id: string
  title: string
  created_at: string
}

export interface AiConversationDetail extends AiConversationSummary {
  messages: AiMessage[]
}

export async function listConversations(token: string): Promise<AiConversationSummary[]> {
  return apiRequest<AiConversationSummary[]>('/ai-assistant/conversations', { token })
}

export async function getConversation(token: string, conversationId: string): Promise<AiConversationDetail> {
  return apiRequest<AiConversationDetail>(`/ai-assistant/conversations/${conversationId}`, { token })
}

export async function sendMessage(
  token: string,
  content: string,
  conversationId?: string,
): Promise<AiConversationDetail> {
  return apiRequest<AiConversationDetail>('/ai-assistant/messages', {
    method: 'POST',
    token,
    body: { content, conversation_id: conversationId ?? null },
  })
}
