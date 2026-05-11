import React, { useState, useEffect, useRef } from 'react'
import Modal from './Modal.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { DAY_NAMES } from '../../utils/dateUtils.js'

const RECUR_TYPES = [
  { id: 'daily',    label: 'Daily' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekends', label: 'Weekends' },
  { id: 'weekly',   label: 'Weekly' },
  { id: 'biweekly', label: 'Biweekly' },
  { id: 'monthly',  label: 'Monthly' },
  { id: 'custom',   label: 'Custom', fullWidth: true },
]

const OCCURRENCES = [
  { value: 1,  label: '1st' },
  { value: 2,  label: '2nd' },
  { value: 3,  label: '3rd' },
  { value: 4,  label: '4th' },
  { value: -1, label: 'Last' },
]

export default function RecurringPopup({ templateId, onClose }) {
  const { state, dispatch } = useApp()
  const existing = templateId ? state.recurringTemplates.find(t => t.id === templateId) : null

  const [title,                 setTitle]                 = useState(existing?.title || '')
  const [notes,                 setNotes]                 = useState(existing?.notes || '')
  const [recurrenceType,        setRecurrenceType]        = useState(existing?.recurrenceType || 'daily')
  const [dayOfWeek,             setDayOfWeek]             = useState(existing?.dayOfWeek ?? 1)
  const [dayOfMonth,            setDayOfMonth]            = useState(existing?.dayOfMonth ?? 1)
  const [monthlyMode,           setMonthlyMode]           = useState(existing?.monthlyMode || 'dayOfMonth')
  const [monthlyWeekOccurrence, setMonthlyWeekOccurrence] = useState(existing?.monthlyWeekOccurrence ?? 1)
  const [customInterval,        setCustomInterval]        = useState(existing?.customInterval ?? 2)
  const [customUnit,            setCustomUnit]            = useState(existing?.customUnit || 'weeks')
  const [startDate,             setStartDate]             = useState(existing?.startDate || '')
  const [endDate,               setEndDate]               = useState(existing?.endDate || '')
  const titleRef = useRef(null)

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50) }, [])

  // Derived visibility flags
  const isCustomWeeks       = recurrenceType === 'custom' && customUnit === 'weeks'
  const isCustomMonths      = recurrenceType === 'custom' && customUnit === 'months'
  const showMonthlyToggle   = recurrenceType === 'monthly' || isCustomMonths
  const showDayOfMonthInput = (recurrenceType === 'monthly' || isCustomMonths) && monthlyMode === 'dayOfMonth'
  const showOccurrencePicker = (recurrenceType === 'monthly' || isCustomMonths) && monthlyMode === 'dayOfWeek'
  const showDayOfWeekPicker =
    ['weekly', 'biweekly'].includes(recurrenceType) ||
    isCustomWeeks ||
    showOccurrencePicker

  const handleSave = () => {
    if (!title.trim()) return
    const payload = {
      title: title.trim(),
      notes,
      recurrenceType,
      dayOfWeek:             showDayOfWeekPicker   ? dayOfWeek             : null,
      dayOfMonth:            showDayOfMonthInput   ? dayOfMonth            : null,
      monthlyMode:           showMonthlyToggle     ? monthlyMode           : null,
      monthlyWeekOccurrence: showOccurrencePicker  ? monthlyWeekOccurrence : null,
      customInterval:        recurrenceType === 'custom' ? customInterval  : null,
      customUnit:            recurrenceType === 'custom' ? customUnit       : null,
      startDate: startDate || null,
      endDate:   endDate   || null,
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
        <input ref={titleRef} className="form-input" placeholder="Recurring task title"
          value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-input" placeholder="Optional notes…"
          value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="form-group">
        <label className="form-label">Schedule</label>
        <div className="recur-type-grid">
          {RECUR_TYPES.map(rt => (
            <button
              key={rt.id}
              type="button"
              className={`recur-type-btn${recurrenceType === rt.id ? ' active' : ''}${rt.fullWidth ? ' recur-full' : ''}`}
              onClick={() => setRecurrenceType(rt.id)}
            >
              {rt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom: interval + unit */}
      {recurrenceType === 'custom' && (
        <div className="form-group">
          <label className="form-label">Repeat every</label>
          <div className="custom-interval-row">
            <input
              type="number" min={1} max={99} className="form-input"
              value={customInterval}
              onChange={e => setCustomInterval(Math.max(1, Number(e.target.value)))}
              style={{ width: 72 }}
            />
            <div className="recur-unit-toggle">
              {['weeks', 'months'].map(u => (
                <button
                  key={u} type="button"
                  className={`recur-type-btn${customUnit === u ? ' active' : ''}`}
                  onClick={() => setCustomUnit(u)}
                >
                  {u.charAt(0).toUpperCase() + u.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly / custom-months: day-of-month vs day-of-week toggle */}
      {showMonthlyToggle && (
        <div className="form-group">
          <label className="form-label">Repeat on</label>
          <div className="recur-type-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button type="button"
              className={`recur-type-btn${monthlyMode === 'dayOfMonth' ? ' active' : ''}`}
              onClick={() => setMonthlyMode('dayOfMonth')}>
              Day of Month
            </button>
            <button type="button"
              className={`recur-type-btn${monthlyMode === 'dayOfWeek' ? ' active' : ''}`}
              onClick={() => setMonthlyMode('dayOfWeek')}>
              Day of Week
            </button>
          </div>
        </div>
      )}

      {/* Day of month number */}
      {showDayOfMonthInput && (
        <div className="form-group">
          <label className="form-label">Day of Month</label>
          <input
            type="number" min={1} max={31} className="form-input"
            value={dayOfMonth}
            onChange={e => setDayOfMonth(Math.max(1, Math.min(31, Number(e.target.value))))}
            style={{ width: 100 }}
          />
        </div>
      )}

      {/* Occurrence picker: 1st / 2nd / 3rd / 4th / Last */}
      {showOccurrencePicker && (
        <div className="form-group">
          <label className="form-label">Occurrence</label>
          <div className="occurrence-grid">
            {OCCURRENCES.map(o => (
              <button
                key={o.value} type="button"
                className={`day-btn${monthlyWeekOccurrence === o.value ? ' active' : ''}`}
                onClick={() => setMonthlyWeekOccurrence(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day of week picker */}
      {showDayOfWeekPicker && (
        <div className="form-group">
          <label className="form-label">Day of Week</label>
          <div className="day-grid">
            {DAY_NAMES.map((d, i) => (
              <button
                key={i} type="button"
                className={`day-btn${dayOfWeek === i ? ' active' : ''}`}
                onClick={() => setDayOfWeek(i)}
              >
                {d[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            Start Date <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(opt.)</span>
          </label>
          <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">
            End Date <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(opt.)</span>
          </label>
          <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
