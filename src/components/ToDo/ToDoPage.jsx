import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { formatShortDate } from '../../utils/dateUtils.js'
import { shouldIgnoreHotkey } from '../../utils/hotkeys.js'
import Icon from '../Icon.jsx'
import ToDoPopup from '../Popups/ToDoPopup.jsx'

const CheckIcon = () => <Icon name="check" size={13} />

export default function ToDoPage() {
  const { state, dispatch } = useApp()
  const [editId, setEditId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [showUndo, setShowUndo] = useState(false)
  const undoTimer = useRef(null)
  const prevLastCompleted = useRef(state.lastCompletedTask)

  useEffect(() => {
    if (state.lastCompletedTask && state.lastCompletedTask !== prevLastCompleted.current) {
      setShowUndo(true)
      clearTimeout(undoTimer.current)
      undoTimer.current = setTimeout(() => setShowUndo(false), 5000)
    }
    prevLastCompleted.current = state.lastCompletedTask
    return () => clearTimeout(undoTimer.current)
  }, [state.lastCompletedTask])

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if (shouldIgnoreHotkey(e)) return
      if (e.key === 'n') { e.preventDefault(); setShowNew(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Tasks promoted to a time block (todoTaskId linkage) are no longer backlog items
  const promotedIds = new Set(state.scheduledBlocks.filter(b => b.todoTaskId).map(b => b.todoTaskId))
  // Only show tasks without recurringTemplateId and not promoted to a time block
  const allTasks = state.tasks.filter(t => !t.recurringTemplateId && !promotedIds.has(t.id))
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
        {showUndo && (
          <button
            className="undo-btn"
            onClick={() => { dispatch({ type: 'UNDO_LAST_COMPLETION' }); setShowUndo(false) }}
            title="Undo Last Completion (Ctrl+Z)"
          >
            <Icon name="undo" size={15} /> Undo
          </button>
        )}
        <label className="show-completed-toggle">
          <input
            type="checkbox"
            checked={state.showCompletedTasks}
            onChange={() => dispatch({ type: 'TOGGLE_SHOW_COMPLETED_TASKS' })}
          />
          Show Completed
        </label>
        <button className="add-btn" title="New Task (N)" aria-label="New task" onClick={() => setShowNew(true)}>
          <Icon name="plus" size={18} />
        </button>
      </div>

      <div className="todo-list">
        {sortedTasks.length === 0 && (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div className="empty-state-icon"><Icon name="check" size={28} /></div>
            {state.showCompletedTasks
              ? <>Nothing on the list.<br />Press <strong>N</strong> or <strong>+</strong> to add a task.</>
              : <>Everything is done.<br />Press <strong>N</strong> or <strong>+</strong> to add more.</>}
          </div>
        )}
        {sortedTasks.map(task => (
          <div key={task.id} className={`todo-item${task.completed ? ' completed' : ''}`}>
            <button
              type="button"
              role="checkbox"
              aria-checked={task.completed}
              aria-label={`Mark "${task.title}" ${task.completed ? 'incomplete' : 'complete'}`}
              className={`task-check${task.completed ? ' checked' : ''}`}
              onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_TASK_COMPLETE', id: task.id }) }}
            >
              <CheckIcon />
            </button>
            <button type="button" className="task-content" onClick={() => setEditId(task.id)}>
              <div className="task-title">{task.title}</div>
              {task.notes && <div className="task-notes">{task.notes}</div>}
              <div className="task-meta">
                {task.assignedDate && (
                  <span className="task-badge date">{formatShortDate(task.assignedDate)}</span>
                )}
              </div>
            </button>
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
