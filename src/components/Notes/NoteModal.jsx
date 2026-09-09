import React, { useState, useEffect, useRef } from 'react'
import Modal from '../Popups/Modal.jsx'
import ConfirmDialog from '../Popups/ConfirmDialog.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { noteToTask } from '../../utils/noteUtils.js'
import { endAfter, getNearestHalfHour, timeToMinutes } from '../../utils/timeUtils.js'
import { useSpeechInput, appendTranscript } from '../../utils/useSpeechInput.js'
import MicIcon from '../MicIcon.jsx'

export default function NoteModal({ noteId, onClose }) {
  const { state, dispatch } = useApp()
  const note = state.notes.find(n => n.id === noteId)

  // draft is what has been typed; base is the text this edit started from.
  // Comparing the two tells us whether the editor is dirty without an effect,
  // so a note changed elsewhere (another device, or the webhook) is picked up
  // while idle instead of being silently overwritten on save.
  const [draft, setDraft] = useState(note?.body || '')
  const [base, setBase] = useState(note?.body || '')
  const [date, setDate] = useState('')
  const [priority, setPriority] = useState(null)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const bodyRef = useRef(null)
  const [confirming, setConfirming] = useState(false)

  const { recording, toggle: toggleRecording, error: speechError } = useSpeechInput(
    text => setDraft(prev => appendTranscript(prev, text))
  )

  useEffect(() => { setTimeout(() => bodyRef.current?.focus(), 50) }, [])

  if (!note) return null

  const dirty = draft !== base
  // Untouched, so always show the live note. Edited, so keep what was typed.
  const body = dirty ? draft : (note.body ?? '')
  const conflict = dirty && note.body !== base

  const takeIncoming = () => {
    setBase(note.body ?? '')
    setDraft(note.body ?? '')
  }


  const timeValid = !startTime || Boolean(endTime && timeToMinutes(endTime) > timeToMinutes(startTime))
  const scheduled = Boolean(date && startTime && endTime && timeValid)

  // A time turns the note into a task *and* the block that occupies the slot,
  // linked so the planner shows it once — as the block — rather than twice.
  const convertToTask = (assignedDate, withTime = false) => {
    const task = noteToTask(body)
    if (!task) return
    const added = dispatch({ type: 'ADD_TASK', ...task, assignedDate, priority })
    if (withTime) {
      dispatch({
        type: 'ADD_SCHEDULED_BLOCK',
        title: task.title, notes: task.notes,
        date: assignedDate, startTime, endTime,
        todoTaskId: added?.task?.id || null,
      })
    }
    dispatch({ type: 'DELETE_NOTE', id: note.id })
    onClose()
  }

  const handleSave = () => {
    if (date) {
      convertToTask(date, scheduled)
    } else {
      dispatch({ type: 'UPDATE_NOTE', id: note.id, updates: { body } })
      onClose()
    }
  }

  // End follows start the way the scheduler does, so picking a start alone is
  // enough to get a valid block.
  const handleStartChange = (val) => {
    setStartTime(val)
    if (!val) return setEndTime('')
    if (!endTime || timeToMinutes(endTime) <= timeToMinutes(val)) setEndTime(endAfter(val))
  }

  const useATime = () => handleStartChange(getNearestHalfHour())

  const confirmDelete = () => {
    dispatch({ type: 'DELETE_NOTE', id: note.id })
    onClose()
  }

  const handleConvert = () => convertToTask(null)


  return (
    <>
    <Modal
      title="Note"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger" onClick={() => setConfirming(true)}>Delete</button>
          <button className="btn btn-convert" onClick={handleConvert} title="Create a To Do from this note">
            → To Do
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className={`btn ${date ? 'btn-convert' : 'btn-primary'}`}
            onClick={handleSave}
            disabled={!timeValid}
          >
            {scheduled ? 'Schedule' : date ? 'Add to To Do' : 'Save'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Note</span>
          <button
            className={`note-modal-mic${recording ? ' recording' : ''}`}
            onClick={toggleRecording}
            aria-pressed={recording}
            type="button"
          >
            <MicIcon size={13} />
            {recording ? 'Stop' : 'Dictate'}
          </button>
        </label>
        {speechError && <span className="dictate-error">{speechError}</span>}
        {conflict && (
          <div className="note-conflict">
            <span>This note changed somewhere else while you were editing.</span>
            <button type="button" className="btn btn-secondary" onClick={takeIncoming}>
              Use the newer text
            </button>
          </div>
        )}
        <textarea
          ref={bodyRef}
          className="form-input"
          value={body}
          onChange={e => setDraft(e.target.value)}
          rows={7}
          placeholder="Note…"
        />
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
        <span style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
          Applies to the To Do this note becomes.
        </span>
      </div>
      <div className="form-group">
        <label className="form-label">
          Schedule as To Do <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(optional)</span>
        </label>
        <input
          type="date"
          className="form-input"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        {date && !startTime && (
          <div className="note-schedule-time-prompt">
            <span>Goes to your To Do list for that day, unscheduled.</span>
            <button type="button" className="btn btn-secondary" onClick={useATime}>
              Give it a time
            </button>
          </div>
        )}
        {date && startTime && (
          <>
            <div className="form-row" style={{ marginTop: 8 }}>
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input
                  type="time" className="form-input" value={startTime}
                  onChange={e => handleStartChange(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
                <input
                  type="time" className="form-input" value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                />
              </div>
            </div>
            {!timeValid
              ? <span style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>End must be after start</span>
              : <span style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
                  Books a time block on that day.
                  {' '}<button type="button" className="link-btn" onClick={() => handleStartChange('')}>
                    Drop the time
                  </button>
                </span>}
          </>
        )}
      </div>
    </Modal>
    {confirming && (
      <ConfirmDialog
        title="Delete note"
        message={"Delete this note?"}
        detail={"This cannot be undone."}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    )}
    </>
  )
}
