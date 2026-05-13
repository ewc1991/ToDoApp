import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import TaskPopup from '../Popups/TaskPopup.jsx'

function CheckIcon() {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1.5 5l3 3 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SortableTask({ task, onEdit }) {
  const { state, dispatch } = useApp()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const completed = task.completed

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-item${completed ? ' completed' : ''}`}
    >
      <span className="drag-handle" {...listeners} {...attributes} title="Drag to schedule">⠿</span>
      <div
        className={`task-check${completed ? ' checked' : ''}`}
        onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_TASK_COMPLETE', id: task.id }) }}
      >
        <CheckIcon />
      </div>
      <div className="task-content" onClick={() => onEdit(task.id)}>
        <div className="task-title">{task.title}</div>
        {task.notes && <div className="task-notes">{task.notes}</div>}
        {task.recurringTemplateId && (
          <div className="task-meta">
            <span className="task-badge">Recurring</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StaticTask({ task, onEdit }) {
  const { dispatch } = useApp()
  const completed = task.completed
  return (
    <div className={`task-item static-task${completed ? ' completed' : ''}`}>
      <div
        className={`task-check${completed ? ' checked' : ''}`}
        onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_TASK_COMPLETE', id: task.id }) }}
      >
        <CheckIcon />
      </div>
      <div className="task-content" onClick={() => onEdit(task.id)}>
        <div className="task-title">{task.title}</div>
        {task.notes && <div className="task-notes">{task.notes}</div>}
      </div>
    </div>
  )
}

export default function UnscheduledSection({ tasks, backlogTasks = [], date, activeId, width }) {
  const pendingCount = tasks.filter(t => !t.completed).length + backlogTasks.length
  const { dispatch } = useApp()
  const [editId, setEditId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [inlineTitle, setInlineTitle] = useState('')
  const inlineRef = useRef(null)

  // Keyboard shortcut: 'n' opens inline add
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShowAdd(true)
        setTimeout(() => inlineRef.current?.focus(), 30)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (showAdd) setTimeout(() => inlineRef.current?.focus(), 30)
  }, [showAdd])

  const handleInlineAdd = () => {
    if (inlineTitle.trim()) {
      dispatch({ type: 'ADD_TASK', title: inlineTitle.trim(), notes: '', assignedDate: date })
      setInlineTitle('')
    }
    setShowAdd(false)
  }

  const handleInlineKey = (e) => {
    if (e.key === 'Enter') handleInlineAdd()
    if (e.key === 'Escape') { setShowAdd(false); setInlineTitle('') }
  }

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'unscheduled-droppable' })

  // For the droppable ref we use the list container
  return (
    <section className="unscheduled-section" style={width != null ? { width, minWidth: width } : undefined}>
      <div className="section-header">
        <div className="section-header-left">
          <span className="section-title">Unscheduled</span>
          {pendingCount > 0 && <span className="unscheduled-count">{pendingCount}</span>}
        </div>
        <div className="section-actions">
          <button
            className="add-btn"
            title="Add task (N)"
            onClick={() => { setShowAdd(true) }}
          >+</button>
        </div>
      </div>

      <div
        ref={setDropRef}
        className={`unscheduled-list${isOver && activeId ? ' drag-over' : ''}`}
      >
        {(tasks.length > 0 || backlogTasks.length > 0) && (
          <div className="task-group-label">Due Today</div>
        )}
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTask key={task.id} task={task} onEdit={setEditId} />
          ))}
        </SortableContext>

        {tasks.length === 0 && backlogTasks.length > 0 && !showAdd && (
          <div className="task-group-empty">Nothing assigned for today.</div>
        )}

        {backlogTasks.length > 0 && (
          <>
            <div className="task-group-label task-group-label--todo">To Do</div>
            {backlogTasks.map(task => (
              <StaticTask key={task.id} task={task} onEdit={setEditId} />
            ))}
          </>
        )}

        {tasks.length === 0 && backlogTasks.length === 0 && !showAdd && (
          <div className="empty-state">
            <div className="empty-state-icon">☑</div>
            Nothing here yet.<br />
            Press <strong>N</strong> or tap <strong>+</strong> to add a task,<br />or drag a block from the time area.
          </div>
        )}

        {showAdd && (
          <div className="inline-add">
            <div className="inline-add-form">
              <input
                ref={inlineRef}
                className="inline-add-input"
                placeholder="Task title, Enter to save…"
                value={inlineTitle}
                onChange={e => setInlineTitle(e.target.value)}
                onKeyDown={handleInlineKey}
                onBlur={handleInlineAdd}
              />
            </div>
            <div className="inline-add-hint">Enter to save · Esc to cancel</div>
          </div>
        )}
      </div>

      {editId && (
        <TaskPopup taskId={editId} date={date} onClose={() => setEditId(null)} />
      )}
    </section>
  )
}
