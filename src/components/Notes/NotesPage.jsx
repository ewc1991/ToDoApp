import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import NoteModal from './NoteModal.jsx'

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10a7 7 0 0014 0"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="8" y1="22" x2="16" y2="22"/>
    </svg>
  )
}

function formatNoteDate(isoStr) {
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NotesPage() {
  const { state, dispatch } = useApp()
  const [body, setBody] = useState('')
  const [date, setDate] = useState('')
  const [recording, setRecording] = useState(false)
  const [editId, setEditId] = useState(null)
  const recognitionRef = useRef(null)
  const bodyRef = useRef(null)

  const notes = useMemo(() =>
    [...state.notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [state.notes]
  )

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        bodyRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null
      recognitionRef.current.onend = null
      recognitionRef.current.onerror = null
      recognitionRef.current.stop()
    }
  }, [])

  const handleAdd = () => {
    if (!body.trim()) return
    if (date) {
      dispatch({ type: 'ADD_TASK', title: body.trim().slice(0, 100), notes: '', assignedDate: date })
    } else {
      dispatch({ type: 'ADD_NOTE', body: body.trim() })
    }
    setBody('')
    setDate('')
    bodyRef.current?.focus()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleAdd()
    }
  }

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
    bodyRef.current?.focus()
  }

  return (
    <div className="notes-page page">
      <div className="notes-toolbar">
        <span className="notes-toolbar-title">Notes</span>
      </div>

      <div className="notes-scroll">
        {/* Composer */}
        <div className="notes-composer" onKeyDown={handleKey}>
          <div className="notes-composer-body-row">
            <textarea
              ref={bodyRef}
              className="notes-composer-body"
              placeholder="Start typing or tap the mic to dictate…"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
            />
            <button
              className={`notes-mic-btn${recording ? ' recording' : ''}`}
              onClick={toggleRecording}
              title={recording ? 'Stop recording' : 'Dictate note (uses browser speech)'}
              type="button"
            >
              <MicIcon />
            </button>
          </div>
          <div className="notes-composer-footer">
            <span className="notes-composer-hint">{recording ? '● Listening…' : '⌘+Enter to save'}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date"
                className="notes-date-input"
                value={date}
                onChange={e => setDate(e.target.value)}
                title="Optional: schedule as To Do"
              />
              {body && (
                <button className="btn btn-secondary" onClick={() => { setBody(''); setDate(''); bodyRef.current?.focus() }}>
                  Clear
                </button>
              )}
              <button
                className={`btn ${date ? 'btn-convert' : 'btn-primary'}`}
                onClick={handleAdd}
                disabled={!body.trim()}
              >
                {date ? 'Add to To Do' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>

        {/* Notes grid */}
        {notes.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 48 }}>
            <div className="empty-state-icon">📝</div>
            Add your first note above.
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map(note => (
              <div key={note.id} className="note-card" onClick={() => setEditId(note.id)}>
                {note.body && <div className="note-card-body">{note.body}</div>}
                <div className="note-card-date">{formatNoteDate(note.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editId && (
        <NoteModal noteId={editId} onClose={() => setEditId(null)} />
      )}
    </div>
  )
}
