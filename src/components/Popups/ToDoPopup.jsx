import React, { useState, useEffect, useRef } from 'react'
import Modal from './Modal.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { isHighPriority } from '../../utils/taskUtils.js'

export default function ToDoPopup({ taskId, date, onClose }) {
  const { state, dispatch } = useApp()
  const existing = taskId ? state.tasks.find(t => t.id === taskId) : null

  const [title, setTitle] = useState(existing?.title || '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [assignedDate, setAssignedDate] = useState(existing?.assignedDate || date || '')
  const [priority, setPriority] = useState(isHighPriority(existing) ? 'high' : null)
  const titleRef = useRef(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50) }, [])

  const handleSave = () => {
    if (!title.trim()) return
    if (existing) {
      dispatch({ type: 'UPDATE_TASK', id: existing.id, updates: { title: title.trim(), notes, assignedDate: assignedDate || null, priority } })
    } else {
      dispatch({ type: 'ADD_TASK', title: title.trim(), notes, assignedDate: assignedDate || null, priority })
    }
    onClose()
  }

  const confirmDelete = () => {
    dispatch({ type: 'DELETE_TASK', id: existing.id })
    onClose()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault(); handleSave()
    }
  }

  return (
    <>
    <Modal
      title={existing ? 'Edit Task' : 'New Task'}
      onClose={onClose}
      footer={
        <>
          {existing && <button className="btn btn-danger" onClick={() => setConfirming(true)}>Delete</button>}
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </>
      }
    >
      <div className="form-group" onKeyDown={handleKey}>
        <label className="form-label">Title</label>
        <input ref={titleRef} className="form-input" placeholder="Task title" value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-input" placeholder="Optional notes…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </div>
      <div className="form-group">
        <label className="form-label">Priority</label>
        <div className="priority-toggle">
          <button
            type="button"
            aria-pressed={priority !== 'high'}
            className={`recur-type-btn${priority !== 'high' ? ' active' : ''}`}
            onClick={() => setPriority(null)}
          >Normal</button>
          <button
            type="button"
            aria-pressed={priority === 'high'}
            className={`recur-type-btn priority-high-btn${priority === 'high' ? ' active' : ''}`}
            onClick={() => setPriority('high')}
          >⚑ High priority</button>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Date <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(optional)</span></label>
        <input type="date" className="form-input" value={assignedDate} onChange={e => setAssignedDate(e.target.value)} />
      </div>
    </Modal>
    {confirming && (
      <ConfirmDialog
        title="Delete task"
        message={`Delete "${existing.title}"?`}
        detail={"This cannot be undone."}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    )}
    </>
  )
}
