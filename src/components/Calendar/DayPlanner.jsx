import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, pointerWithin, closestCenter,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useApp } from '../../store/AppContext.jsx'
import { formatDisplayDate } from '../../utils/dateUtils.js'
import { HOUR_HEIGHT, minutesToTime, timeToMinutes } from '../../utils/timeUtils.js'
import { useIsMobile } from '../../utils/useMediaQuery.js'
import UnscheduledSection from './UnscheduledSection.jsx'
import TimeBlocksSection from './TimeBlocksSection.jsx'
import SchedulerPopup from '../Popups/SchedulerPopup.jsx'

// Custom collision: prefer time-blocks droppable when pointer is within it
function customCollision(args) {
  const ptrIntersections = pointerWithin(args)
  if (ptrIntersections.some(({ id }) => id === 'time-blocks-droppable')) {
    return [{ id: 'time-blocks-droppable' }]
  }
  return closestCenter(args)
}

export default function DayPlanner({ date }) {
  const { state, dispatch } = useApp()
  const [activeTask, setActiveTask] = useState(null)
  const [schedulerPrefill, setSchedulerPrefill] = useState(null)
  const [panelWidth, setPanelWidth] = useState(300)
  // Phones show one panel at a time; the two side-by-side panels do not fit.
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState('blocks')
  const [dividerDragging, setDividerDragging] = useState(false)
  const dividerRef = useRef({ dragging: false, startX: 0, startWidth: 0 })

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dividerRef.current.dragging) return
      const delta = e.clientX - dividerRef.current.startX
      setPanelWidth(Math.max(160, Math.min(520, dividerRef.current.startWidth + delta)))
    }
    const onMouseUp = () => {
      if (!dividerRef.current.dragging) return
      dividerRef.current.dragging = false
      setDividerDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const handleDividerMouseDown = (e) => {
    e.preventDefault()
    dividerRef.current = { dragging: true, startX: e.clientX, startWidth: panelWidth }
    setDividerDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // All unscheduled tasks for this date (not yet promoted to a time block)
  const scheduledTaskIds = useMemo(() => new Set(
    state.scheduledBlocks.filter(b => b.date === date && b.todoTaskId).map(b => b.todoTaskId)
  ), [state.scheduledBlocks, date])

  const unscheduledTasks = useMemo(() =>
    state.tasks.filter(t => t.assignedDate === date && !scheduledTaskIds.has(t.id))
  , [state.tasks, date, scheduledTaskIds])

  const backlogTasks = useMemo(() =>
    state.tasks.filter(t =>
      !t.recurringTemplateId &&
      !t.assignedDate &&
      !t.completed &&
      !scheduledTaskIds.has(t.id)
    )
  , [state.tasks, scheduledTaskIds])

  // Mirrors the badge the Unscheduled panel shows in its own header.
  const pendingCount = useMemo(
    () => unscheduledTasks.filter(t => !t.completed).length + backlogTasks.length,
    [unscheduledTasks, backlogTasks]
  )

  // Dragging a task onto the time blocks is how it gets scheduled, but with
  // the panels in separate tabs that drop target is not on screen. Give the
  // task rows a tap route to the same scheduler.
  const handleScheduleTask = (task) =>
    setSchedulerPrefill({ title: task.title, notes: task.notes, todoTaskId: task.id })

  const handleDragStart = ({ active }) => {
    if (String(active.id).startsWith('block-')) return  // block drag: no overlay
    const task = state.tasks.find(t => t.id === active.id)
    setActiveTask(task || null)
  }

  const handleDragEnd = ({ active, over, delta }) => {
    // Reschedule an existing time block by dragging it
    if (String(active.id).startsWith('block-')) {
      const blockId = String(active.id).replace(/^block-/, '')
      const block = state.scheduledBlocks.find(b => b.id === blockId)
      if (block) {
        const minutesDelta = Math.round((delta.y / HOUR_HEIGHT) * 60 / 15) * 15
        if (minutesDelta !== 0) {
          const oldStart = timeToMinutes(block.startTime)
          const oldEnd   = timeToMinutes(block.endTime)
          const duration = oldEnd - oldStart
          const newStart = Math.max(0, Math.min(1440 - duration, oldStart + minutesDelta))
          dispatch({
            type: 'UPDATE_SCHEDULED_BLOCK',
            id: blockId,
            updates: { startTime: minutesToTime(newStart), endTime: minutesToTime(newStart + duration) },
          })
        }
      }
      return
    }

    setActiveTask(null)
    if (!over) return

    if (over.id === 'time-blocks-droppable') {
      // Promote task to scheduled block
      const task = state.tasks.find(t => t.id === active.id)
      if (task) {
        setSchedulerPrefill({ title: task.title, notes: task.notes, todoTaskId: task.id })
      }
    } else if (over.id !== active.id) {
      // Reorder within unscheduled list — only among incomplete tasks
      const sortable = unscheduledTasks.filter(t => !t.completed)
      const oldIdx = sortable.findIndex(t => t.id === active.id)
      const newIdx = sortable.findIndex(t => t.id === over.id)
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = arrayMove(sortable, oldIdx, newIdx)
        dispatch({ type: 'REORDER_TASKS', orderedIds: reordered.map(t => t.id) })
      }
    }
  }

  return (
    <div className="day-planner">
      <div className="day-planner-header">
        <button className="back-btn" onClick={() => dispatch({ type: 'NAVIGATE_CALENDAR' })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Calendar
        </button>
        <span className="day-planner-date">{formatDisplayDate(date)}</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={customCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        {isMobile && (
          <div className="planner-tabs" role="tablist" aria-label="Day view">
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'blocks'}
              className={`planner-tab${mobileTab === 'blocks' ? ' active' : ''}`}
              onClick={() => setMobileTab('blocks')}
            >
              Time Blocks
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'unscheduled'}
              className={`planner-tab${mobileTab === 'unscheduled' ? ' active' : ''}`}
              onClick={() => setMobileTab('unscheduled')}
            >
              Unscheduled
              {pendingCount > 0 && <span className="planner-tab-count">{pendingCount}</span>}
            </button>
          </div>
        )}

        <div className={`planner-body${isMobile ? ' tabbed' : ''}`}>
          {(!isMobile || mobileTab === 'unscheduled') && (
            <UnscheduledSection
              tasks={unscheduledTasks}
              backlogTasks={backlogTasks}
              date={date}
              activeId={activeTask?.id}
              width={isMobile ? null : panelWidth}
              onSchedule={isMobile ? handleScheduleTask : undefined}
            />
          )}
          {!isMobile && (
            <div
              className={`panel-divider${dividerDragging ? ' dragging' : ''}`}
              onMouseDown={handleDividerMouseDown}
            />
          )}
          {(!isMobile || mobileTab === 'blocks') && <TimeBlocksSection date={date} />}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="drag-overlay">{activeTask.title}</div>
          )}
        </DragOverlay>
      </DndContext>

      {schedulerPrefill && (
        <SchedulerPopup
          date={date}
          prefill={schedulerPrefill}
          onClose={() => setSchedulerPrefill(null)}
        />
      )}
    </div>
  )
}
