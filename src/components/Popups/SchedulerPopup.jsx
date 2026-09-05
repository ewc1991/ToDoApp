import React, { useState, useEffect, useRef } from 'react'
import Modal from './Modal.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import MicIcon from '../MicIcon.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { getNearestHalfHour, endAfter, minutesToTime, timeToMinutes, blockEndMinutes, LAST_MINUTE } from '../../utils/timeUtils.js'
import { useSpeechInput, appendTranscript } from '../../utils/useSpeechInput.js'

export default function SchedulerPopup({ date, blockId, prefill, onClose }) {
  const { state, dispatch } = useApp()
  const existing = blockId ? state.scheduledBlocks.find(b => b.id === blockId) : null

  const defaultStart = existing?.startTime || prefill?.startTime || getNearestHalfHour()
  // A block saved with a broken end reads as end-of-day; show that as a real
  // time so it can be edited back into shape.
  const defaultEnd = existing
    ? minutesToTime(Math.min(LAST_MINUTE, blockEndMinutes(existing)))
    : (prefill?.endTime || endAfter(defaultStart))

  const [title, setTitle] = useState(existing?.title || prefill?.title || '')
  const [notes, setNotes] = useState(existing?.notes || prefill?.notes || '')
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime, setEndTime] = useState(defaultEnd)
  const [blockDate, setBlockDate] = useState(existing?.date || date)
  const titleRef = useRef(null)
  const [confirming, setConfirming] = useState(false)

  const { recording, toggle: toggleRecording, error: speechError } = useSpeechInput(
    text => setTitle(prev => appendTranscript(prev, text))
  )

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50) }, [])

  const handleDictate = () => {
    toggleRecording()
    titleRef.current?.focus()
  }

  // Auto-adjust end time when start changes
  const handleStartChange = (val) => {
    setStartTime(val)
    const startMin = timeToMinutes(val)
    const endMin = timeToMinutes(endTime)
    if (endMin <= startMin) setEndTime(endAfter(val))
  }

  const handleSave = () => {
    if (!title.trim() || !startTime || !endTime) return
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) return

    if (existing) {
      dispatch({ type: 'UPDATE_SCHEDULED_BLOCK', id: existing.id, updates: { title: title.trim(), notes, startTime, endTime, date: blockDate } })
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

  const confirmDelete = () => {
    dispatch({ type: 'DELETE_SCHEDULED_BLOCK', id: existing.id })
    onClose()
  }

  const handleKey = (e) => {
    // BUTTON is excluded so Enter on the Dictate button toggles the mic
    // instead of also saving the block.
    const tag = e.target.tagName
    if (e.key === 'Enter' && !e.shiftKey && tag !== 'TEXTAREA' && tag !== 'BUTTON') {
      e.preventDefault(); handleSave()
    }
  }

  const timeValid = startTime && endTime && timeToMinutes(endTime) > timeToMinutes(startTime)

  return (
    <>
    <Modal
      title={existing ? 'Edit Time Block' : 'Schedule Task'}
      onClose={onClose}
      footer={
        <>
          {existing && <button className="btn btn-danger" onClick={() => setConfirming(true)}>Delete</button>}
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!timeValid}>Save</button>
        </>
      }
    >
      <div className="form-group" onKeyDown={handleKey}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Title</span>
          <button
            className={`dictate-btn${recording ? ' recording' : ''}`}
            onClick={handleDictate}
            aria-pressed={recording}
            title={recording ? 'Stop recording' : 'Dictate the title'}
            type="button"
          >
            <MicIcon size={13} />
            {recording ? 'Stop' : 'Dictate'}
          </button>
        </label>
        <input ref={titleRef} className="form-input" placeholder="Task title" value={title} onChange={e => setTitle(e.target.value)} />
        {recording && <span className="dictate-hint">● Listening… speak the block name</span>}
        {speechError && <span className="dictate-error">{speechError}</span>}
      </div>
      {existing && (
        <div className="form-group">
          <label className="form-label">Date</label>
          <input type="date" className="form-input" value={blockDate} onChange={e => setBlockDate(e.target.value)} />
        </div>
      )}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Start Time</label>
          <input type="time" className="form-input" value={startTime} onChange={e => handleStartChange(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">End Time</label>
          <input type="time" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} />
          {!timeValid && startTime && endTime && (
            <span style={{ fontSize: 16, color: 'var(--red)' }}>End must be after start</span>
          )}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-input" placeholder="Optional notes…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </div>
    </Modal>
    {confirming && (
      <ConfirmDialog
        title="Delete time block"
        message={`Delete the time block "${existing.title}"?`}
        detail={"This cannot be undone."}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    )}
    </>
  )
}
