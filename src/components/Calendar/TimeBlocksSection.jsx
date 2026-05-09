import React, { useRef, useEffect, useState, useMemo } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { useDroppable } from '@dnd-kit/core'
import { HOUR_HEIGHT, layoutBlocks, formatTime, timeToMinutes } from '../../utils/timeUtils.js'
import { formatHour } from '../../utils/timeUtils.js'
import SchedulerPopup from '../Popups/SchedulerPopup.jsx'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const TOTAL_HEIGHT = HOUR_HEIGHT * 24

function CheckIcon() {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1.5 5l3 3 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ScheduledBlock({ block, onEdit }) {
  const { dispatch } = useApp()
  const startMin = timeToMinutes(block.startTime)
  const endMin = timeToMinutes(block.endTime)
  const duration = Math.max(endMin - startMin, 15)

  const top = (startMin / 60) * HOUR_HEIGHT
  const height = Math.max((duration / 60) * HOUR_HEIGHT, 22)
  const leftPct = (block.colIdx / block.numCols) * 100
  const widthPct = (1 / block.numCols) * 100
  const GUTTER = 2

  const style = {
    position: 'absolute',
    top,
    height,
    left: `calc(${leftPct}% + ${GUTTER}px)`,
    width: `calc(${widthPct}% - ${GUTTER * 2}px)`,
  }

  const isShort = height < 40

  return (
    <div
      className={`sched-block${block.completed ? ' completed' : ''}`}
      style={style}
      onClick={() => onEdit(block.id)}
    >
      <div className="sched-block-header">
        <div
          className={`block-check${block.completed ? ' checked' : ''}`}
          onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_BLOCK_COMPLETE', id: block.id }) }}
        >
          <CheckIcon />
        </div>
        {!isShort && <span className="sched-block-time">{formatTime(block.startTime)} – {formatTime(block.endTime)}</span>}
        {isShort && <span className="sched-block-title" style={{ fontSize: 11 }}>{block.title}</span>}
      </div>
      {!isShort && <div className="sched-block-title">{block.title}</div>}
      {!isShort && block.notes && height > 64 && <div className="sched-block-notes">{block.notes}</div>}
    </div>
  )
}

export default function TimeBlocksSection({ date, isOver: parentIsOver }) {
  const { state, dispatch } = useApp()
  const [schedulerState, setSchedulerState] = useState(null)
  const scrollRef = useRef(null)

  const blocks = state.scheduledBlocks.filter(b => b.date === date)
  const displayBlocks = state.showCompletedBlocks ? blocks : blocks.filter(b => !b.completed)
  const layouted = useMemo(() => layoutBlocks(displayBlocks), [displayBlocks])

  // Current time
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date(); return d.getHours() * 60 + d.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date(); setNowMinutes(d.getHours() * 60 + d.getMinutes())
    }, 60000)
    return () => clearInterval(id)
  }, [])

  // Scroll to current time on mount
  useEffect(() => {
    const scrollTo = Math.max(0, (nowMinutes / 60) * HOUR_HEIGHT - 180)
    scrollRef.current?.scrollTo({ top: scrollTo, behavior: 'instant' })
  }, [])

  const { setNodeRef, isOver } = useDroppable({ id: 'time-blocks-droppable' })

  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT

  const openScheduler = (prefill = {}) => setSchedulerState({ prefill })
  const openEdit = (blockId) => setSchedulerState({ blockId })

  // Handle keyboard shortcut 't' for new time block
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); openScheduler()
      }
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
              checked={state.showCompletedBlocks}
              onChange={() => dispatch({ type: 'TOGGLE_SHOW_COMPLETED_BLOCKS' })}
            />
            Show completed
          </label>
          <button className="add-btn" title="Add time block (T)" onClick={() => openScheduler()}>+</button>
        </div>
      </div>

      <div className="time-blocks-scroll" ref={scrollRef}>
        <div className="time-blocks-canvas" style={{ height: TOTAL_HEIGHT }}>
          {/* Hour rows */}
          {HOURS.map(h => (
            <div key={h} className="hour-row" style={{ position: 'absolute', top: h * HOUR_HEIGHT, left: 0, right: 0, height: HOUR_HEIGHT }}>
              <span className="hour-label">{formatHour(h)}</span>
              <div className="hour-line" />
              <div className="hour-half-line" />
            </div>
          ))}

          {/* Current time indicator */}
          <div className="current-time-line" style={{ top: nowTop }}>
            <div className="current-time-dot" />
          </div>

          {/* Drop zone */}
          <div
            ref={setNodeRef}
            className={`time-blocks-droppable${isOver ? ' is-over' : ''}`}
            style={{ position: 'absolute', left: 56, right: 0, top: 0, height: TOTAL_HEIGHT }}
          />

          {/* Blocks layer */}
          <div
            className="blocks-layer"
            style={{ position: 'absolute', left: 56, right: 0, top: 0, height: TOTAL_HEIGHT }}
          >
            {layouted.map(block => (
              <ScheduledBlock key={block.id} block={block} onEdit={openEdit} />
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
