import React, { useState, useEffect } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { formatShortDate } from '../../utils/dateUtils.js'
import ToDoPopup from '../Popups/ToDoPopup.jsx'

function CheckIcon() {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1.5 5l3 3 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ToDoPage() {
  const { state, dispatch } = useApp()
  const [editId, setEditId] = useState(null)
  const [showNew, setShowNew] = useState(false)

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setShowNew(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Only show tasks without recurringTemplateId (recurring instances show in day planner only)
  const allTasks = state.tasks.filter(t => !t.recurringTemplateId)
  const tasks = state.showCompletedTasks ? allTasks : allTasks.filter(t => !t.completed)
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    if (a.assignedDate && b.assignedDate) return a.assignedDate.localeCompare(b.assignedDate)
    if (a.assignedDate) return -1
    if (b.assignedDate) return 1
    return new Date(a.createdAt) - new Date(b.createdAt)
  })

  return (
    <div className="todo-page page">
      <div className="todo-toolbar">
        <span className="todo-toolbar-title">To Do</span>
        <button
          className="undo-btn"
          disabled={!state.lastCompletedTask}
          onClick={() => dispatch({ type: 'UNDO_LAST_COMPLETION' })}
          title="Undo last completion (Ctrl+Z)"
        >
          ↩ Undo
        </button>
        <label className="show-completed-toggle">
          <input
            type="checkbox"
            checked={state.showCompletedTasks}
            onChange={() => dispatch({ type: 'TOGGLE_SHOW_COMPLETED_TASKS' })}
          />
          Show completed
        </label>
        <button className="add-btn" title="New task (N)" onClick={() => setShowNew(true)}>+</button>
      </div>

      <div className="todo-list">
        {sortedTasks.length === 0 && (
          <div className="empty-state" style={{ marginTop: 48 }}>
            <div className="empty-state-icon">✓</div>
            {state.showCompletedTasks ? 'No tasks yet.' : 'All done! Press N or + to add more.'}
          </div>
        )}
        {sortedTasks.map(task => (
          <div
            key={task.id}
            className={`todo-item${task.completed ? ' completed' : ''}`}
            onClick={() => setEditId(task.id)}
          >
            <div
              className={`task-check${task.completed ? ' checked' : ''}`}
              onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_TASK_COMPLETE', id: task.id }) }}
            >
              <CheckIcon />
            </div>
            <div className="task-content">
              <div className="task-title">{task.title}</div>
              {task.notes && <div className="task-notes">{task.notes}</div>}
              <div className="task-meta">
                {task.assignedDate && (
                  <span className="task-badge date">{formatShortDate(task.assignedDate)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(editId || showNew) && (
        <ToDoPopup
          taskId={editId}
          onClose={() => { setEditId(null); setShowNew(false) }}
        />
      )}
    </div>
  )
}
