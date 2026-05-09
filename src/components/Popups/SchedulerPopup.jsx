import React, { useState, useEffect, useRef } from 'react'
import Modal from './Modal.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { getNearestHalfHour, minutesToTime, timeToMinutes, formatTime } from '../../utils/timeUtils.js'

export default function SchedulerPopup({ date, blockId, prefill, onClose }) {
  const { state, dispatch } = useApp()
  const existing = blockId ? state.scheduledBlocks.find(b => b.id === blockId) : null

  const defaultStart = existing?.startTime || prefill?.startTime || getNearestHalfHour()
  const defaultEnd = existing?.endTime || prefill?.endTime || minutesToTime(timeToMinutes(defaultStart) + 30)

  const [title, setTitle] = useState(existing?.title || prefill?.title || '')
  const [notes, setNotes] = useState(existing?.notes || prefill?.notes || '')
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime, setEndTime] = useState(defaultEnd)
  const titleRef = useRef(null)

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50) }, [])

  // Auto-adjust end time when start changes
  const handleStartChange = (val) => {
    setStartTime(val)
    const startMin = timeToMinutes(val)
    const endMin = timeToMinutes(endTime)
    if (endMin <= startMin) setEndTime(minutesToTime(startMin + 30))
  }

  const handleSave = () => {
    if (!title.trim() || !startTime || !endTime) return
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) return

    if (existing) {
      dispatch({ type: 'UPDATE_SCHEDULED_BLOCK', id: existing.id, updates: { title: title.trim(), notes, startTime, endTime } })
    } else {
      dispatch({
        type: 'ADD_SCHEDULED_BLOCK',
        title: title.trim(), notes, date,
        startTime, endTime,
        todoTaskId: prefill?.todoTaskId || null,
      })
    }
    onClose()
  }

  const handleDelete = () => {
    if (existing) dispatch({ type: 'DELETE_SCHEDULED_BLOCK', id: existing.id })
    onClose()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault(); handleSave()
    }
  }

  const timeValid = startTime && endTime && timeToMinutes(endTime) > timeToMinutes(startTime)

  return (
    <Modal
      title={existing ? 'Edit Time Block' : 'Schedule Task'}
      onClose={onClose}
      footer={
        <>
          {existing && <button className="btn btn-danger" onClick={handleDelete}>Delete</button>}
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!timeValid}>Save</button>
        </>
      }
    >
      <div className="form-group" onKeyDown={handleKey}>
        <label className="form-label">Title</label>
        <input ref={titleRef} className="form-input" placeholder="Task title" value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Start Time</label>
          <input type="time" className="form-input" value={startTime} onChange={e => handleStartChange(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">End Time</label>
          <input type="time" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} />
          {!timeValid && startTime && endTime && (
            <span style={{ fontSize: 11, color: 'var(--red)' }}>End must be after start</span>
          )}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-input" placeholder="Optional notes…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </div>
    </Modal>
  )
}
