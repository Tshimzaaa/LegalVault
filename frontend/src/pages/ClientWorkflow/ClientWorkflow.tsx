import { useState } from 'react'
import type { DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import './ClientWorkflow.css'
import { IconPlus } from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'

interface RequestCard {
  title: string
  company: string
  agreementType: string
  created: string
  modified: string
}

type ColumnLabel = 'Submitted' | 'In Progress' | 'In Review' | 'Complete'

interface Column {
  label: ColumnLabel
  color: string
  cards: RequestCard[]
}

const initialColumns: Column[] = [
  {
    label: 'Submitted',
    color: '#9ca3af',
    cards: [
      { title: 'NDA Request', company: 'Company C', agreementType: 'NDA', created: '18 Jul', modified: '18 Jul' },
      { title: 'Supplier Onboarding', company: 'Coastal Retail', agreementType: 'Supplier Agreement', created: '17 Jul', modified: '17 Jul' },
    ],
  },
  {
    label: 'In Progress',
    color: '#3987e5',
    cards: [
      { title: 'Consultancy Agreement Review', company: 'Company C', agreementType: 'Consultancy Agreement', created: '12 Jul', modified: '22 Jul' },
      { title: 'Vendor NDA', company: 'Vantage Logistics', agreementType: 'NDA', created: '10 Jul', modified: '21 Jul' },
    ],
  },
  {
    label: 'In Review',
    color: '#eab308',
    cards: [{ title: 'Supplier Agreement', company: 'Kaya Software', agreementType: 'Supplier Agreement', created: '5 Jul', modified: '20 Jul' }],
  },
  {
    label: 'Complete',
    color: '#22c55e',
    cards: [
      { title: 'Mutual NDA', company: 'Company C', agreementType: 'NDA', created: '28 Jun', modified: '15 Jul' },
      { title: 'Consultancy Agreement', company: 'Nkosi Holdings', agreementType: 'Consultancy Agreement', created: '20 Jun', modified: '10 Jul' },
    ],
  },
]

interface ClientWorkflowProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientWorkflow({ contact, onLogout }: ClientWorkflowProps) {
  const navigate = useNavigate()
  const [columns, setColumns] = useState(initialColumns)
  const [draggingTitle, setDraggingTitle] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ColumnLabel | null>(null)

  const total = columns.reduce((sum, c) => sum + c.cards.length, 0)

  function handleDragStart(e: DragEvent<HTMLDivElement>, cardTitle: string) {
    e.dataTransfer.setData('text/plain', cardTitle)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingTitle(cardTitle)
  }

  function handleDragEnd() {
    setDraggingTitle(null)
    setDragOverColumn(null)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, columnLabel: ColumnLabel) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnLabel)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, targetLabel: ColumnLabel) {
    e.preventDefault()
    const cardTitle = e.dataTransfer.getData('text/plain')
    setDragOverColumn(null)
    setDraggingTitle(null)

    setColumns((prev) => {
      const sourceColumn = prev.find((c) => c.cards.some((card) => card.title === cardTitle))
      const card = sourceColumn?.cards.find((c) => c.title === cardTitle)
      if (!card || sourceColumn?.label === targetLabel) return prev

      return prev.map((col) => {
        if (col.label === sourceColumn?.label) {
          return { ...col, cards: col.cards.filter((c) => c.title !== cardTitle) }
        }
        if (col.label === targetLabel) {
          return { ...col, cards: [...col.cards, card] }
        }
        return col
      })
    })
  }

  return (
    <main className="dash-main workflow-main">
      <header className="dash-topbar">
        <h1>Workflow</h1>
        <div className="workflow-header-actions">
          <span className="chip">
            Total Requests <span className="chip-badge">{total}</span>
          </span>
          <button type="button" className="btn-solid workflow-new-btn" onClick={() => navigate('/client/request-support')}>
            <IconPlus /> New Request
          </button>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      <section className="workflow-board">
        {columns.map((col) => (
          <div
            key={col.label}
            className={`workflow-column${dragOverColumn === col.label ? ' drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, col.label)}
            onDragLeave={() => setDragOverColumn((c) => (c === col.label ? null : c))}
            onDrop={(e) => handleDrop(e, col.label)}
          >
            <div className="workflow-column-header">
              <span className="status-dot" style={{ background: col.color }} />
              <span className="workflow-column-title">{col.label}</span>
              <span className="workflow-column-count">{col.cards.length}</span>
            </div>

            <div className="workflow-column-body">
              {col.cards.map((card) => (
                <div
                  key={card.title}
                  className={`card workflow-card${draggingTitle === card.title ? ' dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, card.title)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="workflow-card-title">{card.title}</span>
                  <span className="workflow-card-client">{card.company}</span>
                  <span className="request-card-type">{card.agreementType}</span>
                  <div className="workflow-card-footer request-card-footer">
                    <span className="deadline-sub">Created {card.created}</span>
                    <span className="deadline-sub">Modified {card.modified}</span>
                  </div>
                </div>
              ))}
              {col.cards.length === 0 && dragOverColumn === col.label && (
                <div className="workflow-drop-placeholder" />
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

export default ClientWorkflow
