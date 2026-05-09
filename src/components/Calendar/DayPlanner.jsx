import React, { useState, useMemo } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, pointerWithin, closestCenter,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useApp } from '../../store/AppContext.jsx'
import { formatDisplayDate } from '../../utils/dateUtils.js'
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

  const handleDragStart = ({ active }) => {
    const task = state.tasks.find(t => t.id === active.id)
    setActiveTask(task || null)
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveTask(null)
    if (!over) return

    if (over.id === 'time-blocks-droppable') {
      // Promote task to scheduled block
      const task = state.tasks.find(t => t.id === active.id)
      if (task) {
        setSchedulerPrefill({ title: task.title, notes: task.notes, todoTaskId: task.id })
      }
    } else if (over.id !== active.id) {
      // Reorder within unscheduled list
      const oldIdx = unscheduledTasks.findIndex(t => t.id === active.id)
      const newIdx = unscheduledTasks.findIndex(t => t.id === over.id)
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = arrayMove(unscheduledTasks, oldIdx, newIdx)
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
      >
        <div className="planner-body">
          <UnscheduledSection tasks={unscheduledTasks} date={date} activeId={activeTask?.id} />
          <TimeBlocksSection date={date} />
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
