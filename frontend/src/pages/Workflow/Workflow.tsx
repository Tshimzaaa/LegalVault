import { useState } from 'react'
import type { DragEvent } from 'react'
import './Workflow.css'
import { IconFlag } from '../../components/icons'

interface WorkflowCard {
  title: string
  client: string
  due: string
  flag: string
}

type ColumnLabel = 'To Do' | 'In Progress' | 'In Review' | 'Done'

interface Column {
  label: ColumnLabel
  color: string
  cards: WorkflowCard[]
}

const initialColumns: Column[] = [
  {
    label: 'To Do',
    color: '#9ca3af',
    cards: [
      { title: 'Draft Settlement Agreement', client: 'Nkosi Holdings', due: '12 days', flag: '#9ca3af' },
      { title: 'Review Lease Renewal', client: 'Coastal Retail', due: '6 days', flag: '#f97316' },
    ],
  },
  {
    label: 'In Progress',
    color: '#3987e5',
    cards: [
      { title: 'Employment Contract Review', client: 'Vantage Logistics', due: '3 days', flag: '#ef4444' },
      { title: 'Prepare Discovery Bundle', client: 'Estate of J. Botha', due: '8 days', flag: '#f97316' },
      { title: 'IP Licensing Draft', client: 'Kaya Software', due: '15 days', flag: '#9ca3af' },
    ],
  },
  {
    label: 'In Review',
    color: '#eab308',
    cards: [{ title: 'NDA – Partner Onboarding', client: 'Thabo & Associates', due: '2 days', flag: '#ef4444' }],
  },
  {
    label: 'Done',
    color: '#22c55e',
    cards: [
      { title: 'Share Purchase Agreement', client: 'Meridian Capital', due: 'Completed', flag: '#22c55e' },
      { title: 'Trademark Filing', client: 'Kaya Software', due: 'Completed', flag: '#22c55e' },
    ],
  },
]

function Workflow() {
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
        <span className="chip">
          Total Items <span className="chip-badge">{total}</span>
        </span>
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
                  <span className="workflow-card-client">{card.client}</span>
                  <div className="workflow-card-footer">
                    <IconFlag color={card.flag} />
                    <span className="deadline-sub">{card.due}</span>
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

export default Workflow
