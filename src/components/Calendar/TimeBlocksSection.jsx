import React, { useRef, useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../store/AppContext.jsx'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { HOUR_HEIGHT, layoutBlocks, timeToMinutes, formatSlot, minutesToTime } from '../../utils/timeUtils.js'
import { today as getToday } from '../../utils/dateUtils.js'
import SchedulerPopup from '../Popups/SchedulerPopup.jsx'

const ALL_SLOTS     = Array.from({ length: 48 }, (_, i) => i * 30)
const DEFAULT_START =  7 * 60  // 7 AM
const DEFAULT_END   = 19 * 60  // 7 PM
const BLOCKS_LEFT   = 72       // px: gutter for time labels (matches CSS)

function BlockContextMenu({ x, y, completed, onToggle, onClose }) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [onClose])

  return createPortal(
    <div
      className="block-context-menu"
      style={{ position: 'fixed', left: x, top: y }}
      onPointerDown={e => e.stopPropagation()}
    >
      <button onClick={onToggle}>
        {completed ? 'Mark as Incomplete' : 'Mark as Done'}
      </button>
    </div>,
    document.body
  )
}

function ScheduledBlock({ block, startOffset, onEdit }) {
  const { dispatch } = useApp()
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `block-${block.id}`,
    data: { type: 'scheduled-block', blockId: block.id },
  })
  const [ctxMenu, setCtxMenu] = useState(null)
  const longPressRef   = useRef(null)
  const touchMovedRef  = useRef(false)

  const startMin = timeToMinutes(block.startTime)
  const endMin   = timeToMinutes(block.endTime)
  const duration = Math.max(endMin - startMin, 15)

  const top    = ((startMin - startOffset) / 60) * HOUR_HEIGHT
  const height = Math.max((duration / 60) * HOUR_HEIGHT, 22)
  const GUTTER = 2
  const style  = {
    position: 'absolute',
    top,
    height,
    left:  `calc(${(block.colIdx / block.numCols) * 100}% + ${GUTTER}px)`,
    width: `calc(${(1 / block.numCols) * 100}% - ${GUTTER * 2}px)`,
    opacity: isDragging ? 0.45 : 1,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    zIndex: isDragging ? 100 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  const isShort = height < 40

  const handleContextMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const handleTouchStart = (e) => {
    touchMovedRef.current = false
    const touch = e.touches[0]
    longPressRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        setCtxMenu({ x: touch.clientX, y: touch.clientY })
      }
    }, 600)
  }

  const handleTouchMove = () => {
    touchMovedRef.current = true
    clearTimeout(longPressRef.current)
  }

  const handleTouchEnd = () => {
    clearTimeout(longPressRef.current)
  }

  const handleResizePointerDown = (e) => {
    e.stopPropagation()
    e.preventDefault()
    const startY = e.clientY
    const origEndMin    = timeToMinutes(block.endTime)
    const blockStartMin = timeToMinutes(block.startTime)
    document.body.style.cursor     = 'ns-resize'
    document.body.style.userSelect = 'none'
    const onPointerMove = (e) => {
      const deltaMin = Math.round(((e.clientY - startY) / HOUR_HEIGHT) * 60 / 15) * 15
      const newEnd = Math.max(blockStartMin + 15, Math.min(1440, origEndMin + deltaMin))
      dispatch({ type: 'UPDATE_SCHEDULED_BLOCK', id: block.id, updates: { endTime: minutesToTime(newEnd) } })
    }
    const onPointerUp = () => {
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // Merge our touch handlers with dnd-kit's in case it uses onTouchStart
  const { onTouchStart: dndTouchStart, ...otherListeners } = listeners || {}

  return (
    <>
      <div
        ref={setNodeRef}
        className={`sched-block${block.completed ? ' completed' : ''}`}
        style={style}
        onClick={e => { e.stopPropagation(); onEdit(block.id) }}
        onContextMenu={handleContextMenu}
        onTouchStart={(e) => { handleTouchStart(e); dndTouchStart?.(e) }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        {...attributes}
        {...otherListeners}
      >
        <div className="sched-block-title">{block.title}</div>
        {!isShort && block.notes && <div className="sched-block-notes">{block.notes}</div>}
        <div
          className="sched-block-resize-handle"
          onPointerDown={handleResizePointerDown}
          onClick={e => e.stopPropagation()}
        />
      </div>
      {ctxMenu && (
        <BlockContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          completed={block.completed}
          onToggle={() => {
            dispatch({ type: 'TOGGLE_BLOCK_COMPLETE', id: block.id })
            setCtxMenu(null)
          }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}

export default function TimeBlocksSection({ date }) {
  const { state, dispatch } = useApp()
  const [schedulerState, setSchedulerState] = useState(null)
  const [showWholeDay, setShowWholeDay] = useState(false)
  const scrollRef = useRef(null)

  // Live current time
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date(); return d.getHours() * 60 + d.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date(); setNowMinutes(d.getHours() * 60 + d.getMinutes())
    }, 60000)
    return () => clearInterval(id)
  }, [])

  const displayStartMinutes = showWholeDay ? 0 : DEFAULT_START
  const displayEndMinutes   = showWholeDay ? 1440 : DEFAULT_END

  const blocks = state.scheduledBlocks.filter(b => b.date === date)

  const displayBlocks = useMemo(() => {
    return blocks.filter(b => {
      if (!state.showCompletedBlocks && b.completed) return false
      return timeToMinutes(b.startTime) < displayEndMinutes &&
             timeToMinutes(b.endTime)   > displayStartMinutes
    })
  }, [blocks, state.showCompletedBlocks, displayStartMinutes, displayEndMinutes])

  const layouted     = useMemo(() => layoutBlocks(displayBlocks), [displayBlocks])
  const canvasHeight = ((displayEndMinutes - displayStartMinutes) / 60) * HOUR_HEIGHT
  const visibleSlots = ALL_SLOTS.filter(m => m >= displayStartMinutes && m <= displayEndMinutes)

  const nowTop     = ((nowMinutes - displayStartMinutes) / 60) * HOUR_HEIGHT
  const nowVisible = nowMinutes >= displayStartMinutes && nowMinutes <= displayEndMinutes

  useEffect(() => {
    if (showWholeDay) {
      const scrollTo = Math.max(0, ((nowMinutes - 0) / 60) * HOUR_HEIGHT - 180)
      scrollRef.current?.scrollTo({ top: scrollTo, behavior: 'smooth' })
    } else {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [showWholeDay])

  const { setNodeRef, isOver } = useDroppable({ id: 'time-blocks-droppable' })

  const openScheduler = (prefill = {}) => setSchedulerState({ prefill })
  const openEdit      = (blockId)      => setSchedulerState({ blockId })

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openScheduler() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const clickedMins = displayStartMinutes + (y / HOUR_HEIGHT) * 60
    const snapped = Math.round(clickedMins / 30) * 30
    const clamped = Math.max(0, Math.min(23 * 60 + 30, snapped))
    openScheduler({ startTime: minutesToTime(clamped), endTime: minutesToTime(clamped + 30) })
  }

  return (
    <section className="time-blocks-section">
      <div className="section-header">
        <span className="section-title">Time Blocks</span>
        <div className="section-actions">
          <label className="show-completed-toggle">
            <input
              type="checkbox"
              checked={showWholeDay}
              onChange={e => setShowWholeDay(e.target.checked)}
            />
            Whole Day
          </label>
          <label className="show-completed-toggle">
            <input
              type="checkbox"
              checked={state.showCompletedBlocks}
              onChange={() => dispatch({ type: 'TOGGLE_SHOW_COMPLETED_BLOCKS' })}
            />
            View Completed
          </label>
          <button className="add-btn" title="Add time block (T)" onClick={() => openScheduler()}>+</button>
        </div>
      </div>

      <div className="time-blocks-scroll" ref={scrollRef}>
        <div className="time-blocks-canvas" style={{ height: canvasHeight }} onClick={handleCanvasClick}>

          {visibleSlots.map(slotMin => {
            const isHour = slotMin % 60 === 0
            const top = ((slotMin - displayStartMinutes) / 60) * HOUR_HEIGHT
            return (
              <div key={slotMin} style={{ position: 'absolute', top, left: 0, right: 0, height: 0 }}>
                <span className={isHour ? 'slot-label hour' : 'slot-label half'}>{formatSlot(slotMin)}</span>
                <div className={isHour ? 'slot-line hour' : 'slot-line half'} />
              </div>
            )
          })}

          {nowVisible && (
            <div className="current-time-line" style={{ top: nowTop }}>
              <div className="current-time-dot" />
            </div>
          )}

          <div
            ref={setNodeRef}
            className={`time-blocks-droppable${isOver ? ' is-over' : ''}`}
            style={{ position: 'absolute', left: BLOCKS_LEFT, right: 0, top: 0, height: canvasHeight }}
          />

          <div
            className="blocks-layer"
            style={{ position: 'absolute', left: BLOCKS_LEFT, right: 0, top: 0, height: canvasHeight }}
          >
            {layouted.map(block => (
              <ScheduledBlock
                key={block.id}
                block={block}
                startOffset={displayStartMinutes}
                onEdit={openEdit}
              />
            ))}
          </div>
        </div>

      </div>

      {schedulerState && (
        <SchedulerPopup
          date={date}
          blockId={schedulerState.blockId}
          prefill={schedulerState.prefill}
          onClose={() => setSchedulerState(null)}
        />
      )}
    </section>
  )
}
