import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { shouldIgnoreHotkey } from '../../utils/hotkeys.js'
import Icon from '../Icon.jsx'
import ToDoPopup from '../Popups/ToDoPopup.jsx'

const CheckIcon = () => <Icon name="check" size={13} />

function SortableTask({ task, onEdit }) {
  const { dispatch } = useApp()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-item${task.completed ? ' completed' : ''}`}
    >
      <span className="drag-handle" {...listeners} {...attributes} title="Drag to schedule">
        <Icon name="grip" size={16} />
      </span>
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
      <button type="button" className="task-content" onClick={() => onEdit(task.id)}>
        <div className="task-title">{task.title}</div>
        {task.notes && <div className="task-notes">{task.notes}</div>}
        {task.recurringTemplateId && (
          <div className="task-meta">
            <span className="task-badge">Recurring</span>
          </div>
        )}
      </button>
    </div>
  )
}

function StaticTask({ task, onEdit }) {
  const { dispatch } = useApp()
  return (
    <div className={`task-item static-task${task.completed ? ' completed' : ''}`}>
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
      <button type="button" className="task-content" onClick={() => onEdit(task.id)}>
        <div className="task-title">{task.title}</div>
        {task.notes && <div className="task-notes">{task.notes}</div>}
      </button>
    </div>
  )
}

export default function UnscheduledSection({ tasks, backlogTasks = [], date, activeId, width }) {
  const { dispatch } = useApp()
  const [editId, setEditId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [inlineTitle, setInlineTitle] = useState('')
  const inlineRef = useRef(null)
  const cancelledRef = useRef(false)

  const incompleteTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks])
  const completedTasks  = useMemo(() => tasks.filter(t =>  t.completed), [tasks])
  const pendingCount = incompleteTasks.length + backlogTasks.length

  // Keyboard shortcut: 'n' opens inline add
  useEffect(() => {
    const handler = (e) => {
      if (shouldIgnoreHotkey(e)) return
      if (e.key === 'n') {
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
    if (cancelledRef.current) { cancelledRef.current = false; return }
    if (inlineTitle.trim()) {
      dispatch({ type: 'ADD_TASK', title: inlineTitle.trim(), notes: '', assignedDate: date })
      setInlineTitle('')
    }
    setShowAdd(false)
  }

  const handleInlineKey = (e) => {
    if (e.key === 'Enter') handleInlineAdd()
    if (e.key === 'Escape') { cancelledRef.current = true; setShowAdd(false); setInlineTitle('') }
  }

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'unscheduled-droppable' })

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
            title="Add Task (N)"
            aria-label="Add task"
            onClick={() => { setShowAdd(true) }}
          ><Icon name="plus" size={18} /></button>
        </div>
      </div>

      <div
        ref={setDropRef}
        className={`unscheduled-list${isOver && activeId ? ' drag-over' : ''}`}
      >
        {(tasks.length > 0 || backlogTasks.length > 0) && (
          <div className="task-group-label">Due Today</div>
        )}

        {/* Sortable incomplete tasks */}
        <SortableContext items={incompleteTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {incompleteTasks.map(task => (
            <SortableTask key={task.id} task={task} onEdit={setEditId} />
          ))}
        </SortableContext>

        {/* Completed tasks sink to the bottom of the date group */}
        {completedTasks.map(task => (
          <StaticTask key={task.id} task={task} onEdit={setEditId} />
        ))}

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
            <div className="empty-state-icon"><Icon name="list" size={28} /></div>
            Plan your day.<br />
            Press <strong>N</strong> or tap <strong>+</strong> to add a task.
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
        <ToDoPopup taskId={editId} date={date} onClose={() => setEditId(null)} />
      )}
    </section>
  )
}
