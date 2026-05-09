import React, { useState, useEffect } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import RecurringPopup from '../Popups/RecurringPopup.jsx'

const RECUR_LABELS = {
  daily: 'Every day',
  weekdays: 'Mon – Fri',
  weekends: 'Sat & Sun',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
}

const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function scheduleLabel(tmpl) {
  const base = RECUR_LABELS[tmpl.recurrenceType] || tmpl.recurrenceType
  if ((tmpl.recurrenceType === 'weekly' || tmpl.recurrenceType === 'biweekly') && tmpl.dayOfWeek != null) {
    return `${base} on ${DAY_SHORT[tmpl.dayOfWeek]}`
  }
  if (tmpl.recurrenceType === 'monthly' && tmpl.dayOfMonth) {
    return `${base} on day ${tmpl.dayOfMonth}`
  }
  return base
}

export default function RecurringPage() {
  const { state } = useApp()
  const [editId, setEditId] = useState(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setShowNew(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const templates = [...state.recurringTemplates].sort((a, b) =>
    a.recurrenceType.localeCompare(b.recurrenceType) || a.title.localeCompare(b.title)
  )

  return (
    <div className="recurring-page page">
      <div className="recurring-toolbar">
        <span className="recurring-toolbar-title">Recurring Tasks</span>
        <button className="add-btn" title="New recurring task (N)" onClick={() => setShowNew(true)}>+</button>
      </div>

      <div className="recurring-list">
        {templates.length === 0 && (
          <div className="empty-state" style={{ marginTop: 48 }}>
            <div className="empty-state-icon">🔁</div>
            No recurring tasks yet.<br />Press <strong>N</strong> or <strong>+</strong> to create one.
          </div>
        )}
        {templates.map(tmpl => (
          <div key={tmpl.id} className="recurring-item" onClick={() => setEditId(tmpl.id)}>
            <div className="recurring-icon">↺</div>
            <div className="recurring-info">
              <div className="recurring-title">{tmpl.title}</div>
              <div className="recurring-schedule">{scheduleLabel(tmpl)}</div>
              {tmpl.notes && <div className="task-notes" style={{ marginTop: 2 }}>{tmpl.notes}</div>}
            </div>
          </div>
        ))}
      </div>

      {(editId || showNew) && (
        <RecurringPopup
          templateId={editId}
          onClose={() => { setEditId(null); setShowNew(false) }}
        />
      )}
    </div>
  )
}
