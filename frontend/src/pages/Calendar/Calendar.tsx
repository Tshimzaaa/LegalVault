import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Calendar.css'
import { IconFlag, IconCheckCircle } from '../../components/icons'
import { getCalendar } from '../../api/matters'
import type { CalendarEvent } from '../../api/matters'

type LoadState = 'loading' | 'error' | 'ready'

function startOfDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function Calendar() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [rangeDays, setRangeDays] = useState(30)

  function load() {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')
    const today = new Date()
    getCalendar(token, startOfDay(today), startOfDay(addDays(today, rangeDays)))
      .then((data) => {
        setEvents(data)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(load, [rangeDays]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = Object.values(
    events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
      ;(acc[e.date] ??= []).push(e)
      return acc
    }, {}),
  ).sort((a, b) => a[0].date.localeCompare(b[0].date))

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Calendar</h1>
        <div className="topbar-actions">
          <select value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
            <option value={7}>Next 7 days</option>
            <option value={30}>Next 30 days</option>
            <option value={90}>Next 90 days</option>
          </select>
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading calendar…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for the calendar.</p>
          <button type="button" className="btn-ghost" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="card calendar-card">
          <div className="list-rows">
            {groups.map((dayEvents) => (
              <div key={dayEvents[0].date} className="calendar-day-group">
                <span className="calendar-day-label">
                  {new Date(dayEvents[0].date).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {dayEvents.map((e, i) => (
                  <button
                    key={`${e.matter_id}-${e.task_id ?? 'deadline'}-${i}`}
                    type="button"
                    className="calendar-event-row"
                    onClick={() => navigate(`/staff/matters/${e.matter_id}`)}
                  >
                    <span className="calendar-event-icon">
                      {e.type === 'matter_deadline' ? <IconFlag color="#ef4444" /> : <IconCheckCircle />}
                    </span>
                    <span className="calendar-event-title">{e.title}</span>
                    <span className="muted">{e.matter_title}</span>
                  </button>
                ))}
              </div>
            ))}
            {groups.length === 0 && <p className="muted">No deadlines or tasks due in this range.</p>}
          </div>
        </section>
      )}
    </main>
  )
}

export default Calendar
