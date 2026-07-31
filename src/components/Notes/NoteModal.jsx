import React, { useState, useEffect, useRef } from 'react'
import Modal from '../Popups/Modal.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { noteToTask } from '../../utils/noteUtils.js'

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10a7 7 0 0014 0"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="8" y1="22" x2="16" y2="22"/>
    </svg>
  )
}

export default function NoteModal({ noteId, onClose }) {
  const { state, dispatch } = useApp()
  const note = state.notes.find(n => n.id === noteId)

  const [body, setBody] = useState(note?.body || '')
  const [date, setDate] = useState('')
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef(null)
  const bodyRef = useRef(null)

  useEffect(() => { setTimeout(() => bodyRef.current?.focus(), 50) }, [])
  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null
      recognitionRef.current.onend = null
      recognitionRef.current.onerror = null
      recognitionRef.current.stop()
    }
  }, [])

  if (!note) return null

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

  const handleDelete = () => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return
    dispatch({ type: 'DELETE_NOTE', id: note.id })
    onClose()
  }

  const handleConvert = () => convertToTask(null)

  const toggleRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .slice(e.resultIndex)
        .filter(r => r.isFinal)
        .map(r => r[0].transcript)
        .join(' ')
      if (transcript) setBody(prev => prev ? prev + ' ' + transcript : transcript)
    }
    recognition.onend = () => setRecording(false)
    recognition.onerror = (e) => {
      setRecording(false)
      if (e.error === 'not-allowed') alert('Microphone access was denied. Please allow it in your browser settings.')
    }
    recognition.start()
    recognitionRef.current = recognition
    setRecording(true)
  }

  return (
    <Modal
      title="Note"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
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
            type="button"
          >
            <MicIcon />
            {recording ? 'Stop' : 'Dictate'}
          </button>
        </label>
        <textarea
          ref={bodyRef}
          className="form-input"
          value={body}
          onChange={e => setBody(e.target.value)}
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
  )
}
