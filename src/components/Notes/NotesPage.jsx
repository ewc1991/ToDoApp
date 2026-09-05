import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { shouldIgnoreHotkey } from '../../utils/hotkeys.js'
import { noteToTask } from '../../utils/noteUtils.js'
import { useSpeechInput, appendTranscript } from '../../utils/useSpeechInput.js'
import MicIcon from '../MicIcon.jsx'
import NoteModal from './NoteModal.jsx'

function formatNoteDate(isoStr) {
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NotesPage() {
  const { state, dispatch } = useApp()
  const [body, setBody] = useState('')
  const [date, setDate] = useState('')
  const [editId, setEditId] = useState(null)
  const [actionId, setActionId] = useState(null)
  const pressTimer = useRef(null)
  const longPressed = useRef(false)
  const bodyRef = useRef(null)

  const { recording, toggle: toggleSpeech } = useSpeechInput(
    text => setBody(prev => appendTranscript(prev, text))
  )

  const notes = useMemo(() =>
    [...state.notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [state.notes]
  )

  useEffect(() => {
    const handler = (e) => {
      if (shouldIgnoreHotkey(e)) return
      if (e.key === 'Escape' && actionId) {
        e.preventDefault()
        setActionId(null)
        return
      }
      if (actionId) return
      if (e.key === 'n') {
        e.preventDefault()
        bodyRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [actionId])

  // Press and hold a card (or right-click) to get at delete without having to
  // open the note first.
  const startPress = (id) => {
    longPressed.current = false
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      setActionId(id)
      navigator.vibrate?.(12)
    }, 500)
  }
  const cancelPress = () => clearTimeout(pressTimer.current)

  // A long press ends in a click too; swallow that one so the note does not
  // also open behind the sheet.
  const openNote = (id) => {
    if (longPressed.current) { longPressed.current = false; return }
    setEditId(id)
  }

  useEffect(() => () => clearTimeout(pressTimer.current), [])

  const handleAdd = () => {
    const trimmed = body.trim()
    if (!trimmed) return
    if (date) {
      dispatch({ type: 'ADD_TASK', ...noteToTask(trimmed), assignedDate: date })
    } else {
      dispatch({ type: 'ADD_NOTE', body: trimmed })
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
    toggleSpeech()
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
              <button
                key={note.id}
                type="button"
                className="note-card"
                onClick={() => openNote(note.id)}
                onTouchStart={() => startPress(note.id)}
                onTouchEnd={cancelPress}
                onTouchMove={cancelPress}
                onTouchCancel={cancelPress}
                onContextMenu={e => { e.preventDefault(); setActionId(note.id) }}
              >
                {note.body && <div className="note-card-body">{note.body}</div>}
                <div className="note-card-date">{formatNoteDate(note.createdAt)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {editId && (
        <NoteModal noteId={editId} onClose={() => setEditId(null)} />
      )}

      {actionId && (
        <div className="modal-backdrop" onClick={() => setActionId(null)}>
          <div
            className="note-actions"
            role="dialog"
            aria-label="Note actions"
            onClick={e => e.stopPropagation()}
          >
            <div className="note-actions-preview">
              {notes.find(n => n.id === actionId)?.body}
            </div>
            <div className="note-actions-buttons">
              <button
                className="btn btn-danger"
                onClick={() => {
                  dispatch({ type: 'DELETE_NOTE', id: actionId })
                  setActionId(null)
                }}
              >
                Delete note
              </button>
              <button className="btn btn-secondary" onClick={() => setActionId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
