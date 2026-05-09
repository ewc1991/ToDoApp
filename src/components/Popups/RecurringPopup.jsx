import React, { useState, useEffect, useRef } from 'react'
import Modal from './Modal.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { DAY_NAMES } from '../../utils/dateUtils.js'

const RECUR_TYPES = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekends', label: 'Weekends' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Biweekly' },
  { id: 'monthly', label: 'Monthly' },
]

export default function RecurringPopup({ templateId, onClose }) {
  const { state, dispatch } = useApp()
  const existing = templateId ? state.recurringTemplates.find(t => t.id === templateId) : null

  const [title, setTitle] = useState(existing?.title || '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [recurrenceType, setRecurrenceType] = useState(existing?.recurrenceType || 'daily')
  const [dayOfWeek, setDayOfWeek] = useState(existing?.dayOfWeek ?? 1)
  const [dayOfMonth, setDayOfMonth] = useState(existing?.dayOfMonth ?? 1)
  const [startDate, setStartDate] = useState(existing?.startDate || '')
  const [endDate, setEndDate] = useState(existing?.endDate || '')
  const titleRef = useRef(null)

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50) }, [])

  const handleSave = () => {
    if (!title.trim()) return
    const payload = {
      title: title.trim(), notes, recurrenceType,
      dayOfWeek: ['weekly', 'biweekly'].includes(recurrenceType) ? dayOfWeek : null,
      dayOfMonth: recurrenceType === 'monthly' ? dayOfMonth : null,
      startDate: startDate || null, endDate: endDate || null,
    }
    if (existing) {
      dispatch({ type: 'UPDATE_RECURRING_TEMPLATE', id: existing.id, updates: payload })
    } else {
      dispatch({ type: 'ADD_RECURRING_TEMPLATE', ...payload })
    }
    onClose()
  }

  const handleDelete = () => {
    if (existing) dispatch({ type: 'DELETE_RECURRING_TEMPLATE', id: existing.id })
    onClose()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault(); handleSave()
    }
  }

  return (
    <Modal
      title={existing ? 'Edit Recurring Task' : 'New Recurring Task'}
      onClose={onClose}
      footer={
        <>
          {existing && <button className="btn btn-danger" onClick={handleDelete}>Delete</button>}
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </>
      }
    >
      <div className="form-group" onKeyDown={handleKey}>
        <label className="form-label">Title</label>
        <input ref={titleRef} className="form-input" placeholder="Recurring task title" value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-input" placeholder="Optional notes…" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="form-group">
        <label className="form-label">Schedule</label>
        <div className="recur-type-grid">
          {RECUR_TYPES.map(rt => (
            <button
              key={rt.id}
              className={`recur-type-btn${recurrenceType === rt.id ? ' active' : ''}`}
              onClick={() => setRecurrenceType(rt.id)}
              type="button"
            >
              {rt.label}
            </button>
          ))}
        </div>
      </div>

      {(recurrenceType === 'weekly' || recurrenceType === 'biweekly') && (
        <div className="form-group">
          <label className="form-label">Day of Week</label>
          <div className="day-grid">
            {DAY_NAMES.map((d, i) => (
              <button
                key={i}
                className={`day-btn${dayOfWeek === i ? ' active' : ''}`}
                onClick={() => setDayOfWeek(i)}
                type="button"
              >
                {d[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {recurrenceType === 'monthly' && (
        <div className="form-group">
          <label className="form-label">Day of Month</label>
          <input
            type="number" min={1} max={31} className="form-input"
            value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))}
            style={{ width: 100 }}
          />
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Start Date <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(opt.)</span></label>
          <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">End Date <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(opt.)</span></label>
          <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
