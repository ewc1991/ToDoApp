import React, { useState, useEffect, useRef } from 'react'
import Modal from './Modal.jsx'
import { useApp } from '../../store/AppContext.jsx'

export default function TaskPopup({ taskId, date, onClose }) {
  const { state, dispatch } = useApp()
  const existing = taskId ? state.tasks.find(t => t.id === taskId) : null

  const [title, setTitle] = useState(existing?.title || '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const titleRef = useRef(null)

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50) }, [])

  const handleSave = () => {
    if (!title.trim()) return
    if (existing) {
      dispatch({ type: 'UPDATE_TASK', id: existing.id, updates: { title: title.trim(), notes } })
    } else {
      dispatch({ type: 'ADD_TASK', title: title.trim(), notes, assignedDate: date })
    }
    onClose()
  }

  const handleDelete = () => {
    if (existing) dispatch({ type: 'DELETE_TASK', id: existing.id })
    onClose()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <Modal
      title={existing ? 'Edit Task' : 'New Task'}
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
        <input
          ref={titleRef}
          className="form-input"
          placeholder="Task title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea
          className="form-input"
          placeholder="Optional notes…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
        />
      </div>
    </Modal>
  )
}
