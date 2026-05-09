import React, { useRef, useEffect, useState, useMemo } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { useDroppable } from '@dnd-kit/core'
import { HOUR_HEIGHT, layoutBlocks, formatTime, timeToMinutes, formatSlot } from '../../utils/timeUtils.js'
import SchedulerPopup from '../Popups/SchedulerPopup.jsx'

const ALL_SLOTS = Array.from({ length: 48 }, (_, i) => i * 30) // 0, 30, 60 … 1410

const DEFAULT_START = 8 * 60   // 8 AM
const DEFAULT_END   = 20 * 60  // 8 PM

function CheckIcon() {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1.5 5l3 3 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ScheduledBlock({ block, startOffset, onEdit }) {
  const { dispatch } = useApp()
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
  }

  const isShort = height < 40

  return (
    <div className={`sched-block${block.completed ? ' completed' : ''}`} style={style} onClick={() => onEdit(block.id)}>
      <div className="sched-block-header">
        <div
          className={`block-check${block.completed ? ' checked' : ''}`}
          onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_BLOCK_COMPLETE', id: block.id }) }}
        >
          <CheckIcon />
        </div>
        {!isShort && <span className="sched-block-time">{formatTime(block.startTime)} – {formatTime(block.endTime)}</span>}
        {isShort  && <span className="sched-block-title" style={{ fontSize: 11 }}>{block.title}</span>}
      </div>
      {!isShort && <div className="sched-block-title">{block.title}</div>}
      {!isShort && block.notes && height > 64 && <div className="sched-block-notes">{block.notes}</div>}
    </div>
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

  // Keep only blocks that overlap the visible window
  const displayBlocks = useMemo(() => {
    return blocks.filter(b => {
      if (!state.showCompletedBlocks && b.completed) return false
      // include block if it overlaps [displayStart, displayEnd]
      return timeToMinutes(b.startTime) < displayEndMinutes &&
             timeToMinutes(b.endTime)   > displayStartMinutes
    })
  }, [blocks, state.showCompletedBlocks, displayStartMinutes, displayEndMinutes])

  const layouted    = useMemo(() => layoutBlocks(displayBlocks), [displayBlocks])
  const canvasHeight = ((displayEndMinutes - displayStartMinutes) / 60) * HOUR_HEIGHT
  const visibleSlots = ALL_SLOTS.filter(m => m >= displayStartMinutes && m <= displayEndMinutes)

  // Current-time indicator position (only when within visible window)
  const nowTop = ((nowMinutes - displayStartMinutes) / 60) * HOUR_HEIGHT
  const nowVisible = nowMinutes >= displayStartMinutes && nowMinutes <= displayEndMinutes

  // Scroll: default view needs no scroll (8 AM is top); whole-day scrolls to current time
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
            Whole day
          </label>
          <label className="show-completed-toggle">
            <input
              type="checkbox"
              checked={state.showCompletedBlocks}
              onChange={() => dispatch({ type: 'TOGGLE_SHOW_COMPLETED_BLOCKS' })}
            />
            Completed
          </label>
          <button className="add-btn" title="Add time block (T)" onClick={() => openScheduler()}>+</button>
        </div>
      </div>

      <div className="time-blocks-scroll" ref={scrollRef}>
        <div className="time-blocks-canvas" style={{ height: canvasHeight }}>

          {visibleSlots.map(slotMin => {
            const isHour = slotMin % 60 === 0
            const top = ((slotMin - displayStartMinutes) / 60) * HOUR_HEIGHT
            return (
              <div key={slotMin} style={{ position: 'absolute', top, left: 56, right: 0, height: 0 }}>
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
            style={{ position: 'absolute', left: 56, right: 0, top: 0, height: canvasHeight }}
          />

          <div
            className="blocks-layer"
            style={{ position: 'absolute', left: 56, right: 0, top: 0, height: canvasHeight }}
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

        {blocks.length === 0 && (
          <div className="empty-state" style={{ marginTop: 24 }}>
            <div className="empty-state-icon">🗓</div>
            Nothing scheduled yet.<br />
            Press <strong>T</strong> or tap <strong>+</strong> to add a time block,<br />or drag a task here.
          </div>
        )}
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
