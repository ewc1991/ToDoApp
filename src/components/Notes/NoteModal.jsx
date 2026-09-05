import React, { useState, useEffect, useRef } from 'react'
import Modal from '../Popups/Modal.jsx'
import ConfirmDialog from '../Popups/ConfirmDialog.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { noteToTask } from '../../utils/noteUtils.js'
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


  const convertToTask = (assignedDate) => {
    const task = noteToTask(body)
    if (!task) return
    dispatch({ type: 'ADD_TASK', ...task, assignedDate })
    dispatch({ type: 'DELETE_NOTE', id: note.id })
    onClose()
  }

  const handleSave = () => {
    if (date) {
      convertToTask(date)
    } else {
      dispatch({ type: 'UPDATE_NOTE', id: note.id, updates: { body } })
      onClose()
    }
  }

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
          >
            {date ? 'Add to To Do' : 'Save'}
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
        <label className="form-label">
          Schedule as To Do <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(optional)</span>
        </label>
        <input
          type="date"
          className="form-input"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        {date && (
          <span style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
            Saving will move this note to your To Do list on that date.
          </span>
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
