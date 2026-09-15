import { useEffect, useRef, useState, type FormEvent } from 'react'
import './LearnedFriend.css'
import { IconSend } from '../../components/icons'
import { listConversations, getConversation, sendMessage } from '../../api/aiAssistant'
import type { AiConversationSummary, AiMessage } from '../../api/aiAssistant'

type LoadState = 'loading' | 'error' | 'ready'

function LearnedFriend() {
  const [conversations, setConversations] = useState<AiConversationSummary[]>([])
  const [conversationsStatus, setConversationsStatus] = useState<LoadState>('loading')
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [messagesStatus, setMessagesStatus] = useState<LoadState>('ready')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  function token() {
    return localStorage.getItem('access_token')
  }

  function loadConversations() {
    const t = token()
    if (!t) {
      setConversationsStatus('error')
      return
    }
    setConversationsStatus('loading')
    listConversations(t)
      .then((data) => {
        setConversations(data)
        setConversationsStatus('ready')
      })
      .catch(() => setConversationsStatus('error'))
  }

  useEffect(() => {
    loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'end' })
  }, [messages, sending])

  function openConversation(id: string) {
    const t = token()
    if (!t) return
    setActiveConversationId(id)
    setMessagesStatus('loading')
    getConversation(t, id)
      .then((data) => {
        setMessages(data.messages)
        setMessagesStatus('ready')
      })
      .catch(() => setMessagesStatus('error'))
  }

  function startNewConversation() {
    setActiveConversationId(null)
    setMessages([])
    setMessagesStatus('ready')
    setSendError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    const t = token()
    if (!t) return

    const optimisticUserMessage: AiMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUserMessage])
    setDraft('')
    setSending(true)
    setSendError(null)

    try {
      const conversation = await sendMessage(t, content, activeConversationId ?? undefined)
      setMessages(conversation.messages)
      if (activeConversationId !== conversation.id) {
        setActiveConversationId(conversation.id)
        loadConversations()
      }
    } catch {
      setSendError("Couldn't reach the assistant. Your message wasn't sent — try again.")
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMessage.id))
      setDraft(content)
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="dash-main learned-friend-main">
      <header className="dash-topbar">
        <h1>Learned Friend</h1>
        <div className="topbar-actions">
          <span className="chip">
            Conversations <span className="chip-badge">{conversations.length}</span>
          </span>
        </div>
      </header>

      <div className="lf-chat-layout">
        <aside className="lf-chat-sidebar" aria-label="Past conversations">
          <button type="button" className="btn-ghost lf-new-chat-btn" onClick={startNewConversation}>
            + New conversation
          </button>
          {conversationsStatus === 'loading' && <p className="muted">Loading…</p>}
          {conversationsStatus === 'error' && <p className="muted">Couldn&rsquo;t load past conversations.</p>}
          {conversationsStatus === 'ready' && conversations.length === 0 && (
            <p className="muted">No conversations yet.</p>
          )}
          <ul className="lf-conversation-list">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`lf-conversation-item${c.id === activeConversationId ? ' active' : ''}`}
                  onClick={() => openConversation(c.id)}
                  aria-current={c.id === activeConversationId}
                >
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="lf-chat-main" aria-label="Conversation">
          <div className="lf-messages" role="log">
            {messagesStatus === 'loading' && (
              <div className="dash-state" role="status" aria-live="polite">
                <span className="dash-spinner" aria-hidden="true" />
                <p>Loading conversation…</p>
              </div>
            )}

            {messagesStatus !== 'loading' && messages.length === 0 && (
              <div className="lf-empty-chat">
                <p className="muted">
                  Ask about a clause or negotiating position — answers are grounded in the org&rsquo;s
                  pre-approved fallback clauses where relevant. This isn&rsquo;t a substitute for a lawyer&rsquo;s
                  sign-off on anything material.
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`lf-message lf-message-${m.role}`}>
                <span className="lf-message-role">{m.role === 'user' ? 'You' : 'Learned Friend'}</span>
                <p className="lf-message-content">{m.content}</p>
              </div>
            ))}

            {sending && (
              <div className="lf-message lf-message-assistant lf-message-pending" aria-hidden="true">
                <span className="lf-message-role">Learned Friend</span>
                <span className="dash-spinner" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {sendError && (
            <p className="lf-send-error" role="alert">
              {sendError}
            </p>
          )}

          <form className="lf-composer" onSubmit={handleSubmit}>
            <label htmlFor="lf-draft" className="visually-hidden">
              Message Learned Friend
            </label>
            <textarea
              id="lf-draft"
              className="lf-composer-input"
              placeholder="Ask about a clause or negotiating position…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              rows={2}
              disabled={sending}
            />
            <button type="submit" className="lf-send-btn" disabled={sending || !draft.trim()} aria-label="Send message">
              <IconSend aria-hidden="true" />
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}

export default LearnedFriend
