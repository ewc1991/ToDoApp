import React, { useState, useEffect, useRef } from 'react'
import Modal from '../Popups/Modal.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { noteToTask } from '../../utils/noteUtils.js'
import Icon from '../Icon.jsx'

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
            <Icon name="arrowRight" size={15} /> To Do
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
            <Icon name="mic" size={14} />
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
