import React, { useMemo, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useApp } from '../../store/AppContext.jsx'
import { isAllDay } from '../../utils/timeUtils.js'
import { isHighPriority } from '../../utils/taskUtils.js'
import SchedulerPopup from '../Popups/SchedulerPopup.jsx'

function CheckIcon() {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1.5 5l3 3 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Things that apply to the whole date rather than a slot on it — a trip, a
// deadline, someone's birthday. Stored as scheduled blocks with allDay set, so
// they complete, link back to a task and sync exactly like a timed block.
export default function AllDaySection({ date, activeId }) {
  const { state, dispatch } = useApp()
  const [editId, setEditId] = useState(null)
  const [adding, setAdding] = useState(false)

  const items = useMemo(
    () => state.scheduledBlocks
      .filter(b => b.date === date && isAllDay(b))
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))),
    [state.scheduledBlocks, date]
  )

  const flaggedTaskIds = useMemo(
    () => new Set(state.tasks.filter(isHighPriority).map(t => t.id)),
    [state.tasks]
  )

  const { setNodeRef, isOver } = useDroppable({ id: 'all-day-droppable' })

  return (
    <section className="all-day-section">
      <div className="section-header">
        <div className="section-header-left">
          <span className="section-title">All Day</span>
          {items.length > 0 && <span className="unscheduled-count">{items.length}</span>}
        </div>
        <div className="section-actions">
          <button
            className="add-btn"
            title="Add an all-day item"
            aria-label="Add an all-day item"
            onClick={() => setAdding(true)}
          >+</button>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`all-day-list${isOver && activeId ? ' drag-over' : ''}${items.length ? '' : ' empty'}`}
      >
        {items.map(item => (
          <div
            key={item.id}
            className={`all-day-item${item.completed ? ' completed' : ''}${flaggedTaskIds.has(item.todoTaskId) ? ' high-priority' : ''}`}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={Boolean(item.completed)}
              aria-label={`Mark "${item.title}" ${item.completed ? 'incomplete' : 'complete'}`}
              className={`task-check${item.completed ? ' checked' : ''}`}
              onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_BLOCK_COMPLETE', id: item.id }) }}
            >
              <CheckIcon />
            </button>
            <button type="button" className="all-day-content" onClick={() => setEditId(item.id)}>
              <span className="all-day-title">
                {flaggedTaskIds.has(item.todoTaskId) && (
                  <span className="sched-block-flag" title="High priority">⚑</span>
                )}
                {item.title}
              </span>
              {item.notes && <span className="all-day-notes">{item.notes}</span>}
            </button>
          </div>
        ))}

        {items.length === 0 && (
          <div className="all-day-empty">
            Nothing all day. Drop a task here, or tap <strong>+</strong>.
          </div>
        )}
      </div>

      {(adding || editId) && (
        <SchedulerPopup
          date={date}
          blockId={editId}
          prefill={editId ? undefined : { allDay: true }}
          onClose={() => { setAdding(false); setEditId(null) }}
        />
      )}
    </section>
  )
}
