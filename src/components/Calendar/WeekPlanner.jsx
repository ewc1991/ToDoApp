import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useApp } from '../../store/AppContext.jsx'
import { DAY_NAMES, MONTH_NAMES_SHORT, addDays, getDayOfWeek, getDayOfMonth, parseDate, today } from '../../utils/dateUtils.js'
import {
  HOUR_HEIGHT, LAST_MINUTE, layoutBlocks, timeToMinutes, minutesToTime, formatSlot, blockEndMinutes, isAllDay,
} from '../../utils/timeUtils.js'
import { isHighPriority } from '../../utils/taskUtils.js'
import { ScheduledBlock } from './TimeBlocksSection.jsx'
import PlannerViewToggle from './PlannerViewToggle.jsx'
import SchedulerPopup from '../Popups/SchedulerPopup.jsx'
import ContextMenu from '../Popups/ContextMenu.jsx'

const ALL_SLOTS     = Array.from({ length: 48 }, (_, i) => i * 30)
const DEFAULT_START =  7 * 60  // 7 AM
const DEFAULT_END   = 19 * 60  // 7 PM
const BLOCKS_LEFT   = 72       // px: gutter for time labels (matches CSS)

function CheckIcon() {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1.5 5l3 3 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// "Oct 25 – 31, 2026", or "Oct 29 – Nov 4, 2026" across a month boundary.
function formatWeekRange(start, end) {
  const s = parseDate(start), e = parseDate(end)
  const from = `${MONTH_NAMES_SHORT[s.getMonth()]} ${s.getDate()}`
  const to   = s.getMonth() === e.getMonth() ? `${e.getDate()}` : `${MONTH_NAMES_SHORT[e.getMonth()]} ${e.getDate()}`
  return s.getFullYear() === e.getFullYear()
    ? `${from} – ${to}, ${e.getFullYear()}`
    : `${from}, ${s.getFullYear()} – ${to}, ${e.getFullYear()}`
}

// Seven days (Sun–Sat, matching the month calendar) of the same grid the day
// view shows. Blocks drag between days as well as up and down.
export default function WeekPlanner({ date }) {
  const { state, dispatch } = useApp()
  const [schedulerState, setSchedulerState] = useState(null) // { date, blockId?, prefill? }
  const [menu, setMenu] = useState(null) // { id, label, x, y } of an open right-click menu
  const openMenu = (e, id, label) => { e.preventDefault(); setMenu({ id, label, x: e.clientX, y: e.clientY }) }
  const closeMenu = useCallback(() => setMenu(null), [])
  const [showWholeDay, setShowWholeDay] = useState(false)
  const scrollRef  = useRef(null)
  const columnsRef = useRef(null)
  const todayStr   = today()

  const weekStart = addDays(date, -getDayOfWeek(date))
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekEnd = days[6]
  const hasToday = days.includes(todayStr)

  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date(); return d.getHours() * 60 + d.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date(); setNowMinutes(d.getHours() * 60 + d.getMinutes())
    }, 60000)
    return () => clearInterval(id)
  }, [])

  const weekBlocks = useMemo(
    () => state.scheduledBlocks.filter(b => b.date >= weekStart && b.date <= weekEnd),
    [state.scheduledBlocks, weekStart, weekEnd]
  )

  const { timedByDay, allDayByDay } = useMemo(() => {
    const timedByDay = {}, allDayByDay = {}
    days.forEach(d => { timedByDay[d] = []; allDayByDay[d] = [] })
    weekBlocks.forEach(b => (isAllDay(b) ? allDayByDay : timedByDay)[b.date].push(b))
    Object.values(allDayByDay).forEach(list =>
      list.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    )
    return { timedByDay, allDayByDay }
  }, [days, weekBlocks])

  const flaggedTaskIds = useMemo(
    () => new Set(state.tasks.filter(isHighPriority).map(t => t.id)),
    [state.tasks]
  )

  // 7 AM–7 PM, widened to whole hours so every block in the week fits.
  const { displayStartMinutes, displayEndMinutes } = useMemo(() => {
    if (showWholeDay) return { displayStartMinutes: 0, displayEndMinutes: 1440 }
    const timed = weekBlocks.filter(b => !isAllDay(b))
    const start = timed.reduce((min, b) => Math.min(min, timeToMinutes(b.startTime)), DEFAULT_START)
    const end   = timed.reduce((max, b) => Math.max(max, blockEndMinutes(b)),       DEFAULT_END)
    return {
      displayStartMinutes: Math.max(0, Math.floor(start / 60) * 60),
      displayEndMinutes:   Math.min(1440, Math.ceil(end / 60) * 60),
    }
  }, [showWholeDay, weekBlocks])

  const canvasHeight = ((displayEndMinutes - displayStartMinutes) / 60) * HOUR_HEIGHT
  const visibleSlots = ALL_SLOTS.filter(m => m >= displayStartMinutes && m <= displayEndMinutes)
  const nowTop       = ((nowMinutes - displayStartMinutes) / 60) * HOUR_HEIGHT
  const nowVisible   = nowMinutes >= displayStartMinutes && nowMinutes <= displayEndMinutes

  useEffect(() => {
    // The whole day is 24 rows tall; open it at the working day, not midnight.
    const top = showWholeDay ? (DEFAULT_START / 60) * HOUR_HEIGHT : 0
    scrollRef.current?.scrollTo({ top, behavior: 'smooth' })
  }, [showWholeDay])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragEnd = ({ active, delta }) => {
    const blockId = String(active.id).replace(/^block-/, '')
    const block = state.scheduledBlocks.find(b => b.id === blockId)
    const colWidth = columnsRef.current?.getBoundingClientRect().width / 7
    if (!block || !colWidth) return
    const fromIdx = days.indexOf(block.date)
    const toIdx   = Math.max(0, Math.min(6, fromIdx + Math.round(delta.x / colWidth)))
    const minutesDelta = Math.round((delta.y / HOUR_HEIGHT) * 60 / 15) * 15
    if (toIdx === fromIdx && minutesDelta === 0) return
    const oldStart = timeToMinutes(block.startTime)
    const duration = blockEndMinutes(block) - oldStart
    const newStart = Math.max(0, Math.min(1440 - duration, oldStart + minutesDelta))
    dispatch({
      type: 'UPDATE_SCHEDULED_BLOCK',
      id: blockId,
      updates: {
        date: days[toIdx],
        startTime: minutesToTime(newStart),
        endTime: minutesToTime(Math.min(LAST_MINUTE, newStart + duration)),
      },
    })
  }

  const handleColumnClick = (e, day) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const snapped = Math.round((displayStartMinutes + (y / HOUR_HEIGHT) * 60) / 30) * 30
    const clamped = Math.max(0, Math.min(23 * 60 + 30, snapped))
    setSchedulerState({
      date: day,
      prefill: { startTime: minutesToTime(clamped), endTime: minutesToTime(Math.min(LAST_MINUTE, clamped + 30)) },
    })
  }

  const openDay = (day) => {
    dispatch({ type: 'SET_PLANNER_VIEW', view: 'day' })
    dispatch({ type: 'NAVIGATE_DATE', dateStr: day })
  }

  return (
    <div className="day-planner week-planner">
      <div className="day-planner-header">
        <button className="back-btn" onClick={() => dispatch({ type: 'NAVIGATE_CALENDAR' })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Calendar
        </button>
        <div className="day-planner-date-nav">
          <button
            className="icon-btn"
            title="Previous week"
            onClick={() => dispatch({ type: 'NAVIGATE_DATE', dateStr: addDays(date, -7) })}
          >
            ‹
          </button>
          <span className="day-planner-date">{formatWeekRange(weekStart, weekEnd)}</span>
          <button
            className="icon-btn"
            title="Next week"
            onClick={() => dispatch({ type: 'NAVIGATE_DATE', dateStr: addDays(date, 7) })}
          >
            ›
          </button>
        </div>
        <div className="planner-header-actions">
          <label className="show-completed-toggle">
            <input
              type="checkbox"
              checked={showWholeDay}
              onChange={e => setShowWholeDay(e.target.checked)}
            />
            Whole Day
          </label>
          {!hasToday && (
            <button className="today-btn" onClick={() => dispatch({ type: 'NAVIGATE_DATE', dateStr: todayStr })}>
              This Week
            </button>
          )}
          <PlannerViewToggle />
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="week-scroll" ref={scrollRef}>
          <div className="week-sticky">
            <div className="week-row">
              <div />
              {days.map(day => (
                <button
                  key={day}
                  type="button"
                  className={`week-day-head${day === todayStr ? ' today' : ''}`}
                  aria-current={day === todayStr ? 'date' : undefined}
                  title="Open this day"
                  onClick={() => openDay(day)}
                >
                  <span className="week-day-name">{DAY_NAMES[getDayOfWeek(day)]}</span>
                  <span className="week-day-num">{getDayOfMonth(day)}</span>
                </button>
              ))}
            </div>
            <div className="week-row week-allday-row">
              <div className="week-allday-label">All day</div>
              {days.map(day => (
                <div
                  key={day}
                  className="week-allday-cell"
                  title="Add an all-day item"
                  onClick={() => setSchedulerState({ date: day, prefill: { allDay: true } })}
                >
                  {allDayByDay[day].map(item => (
                    <div
                      key={item.id}
                      className={`week-allday-chip${item.completed ? ' completed' : ''}${flaggedTaskIds.has(item.todoTaskId) ? ' high-priority' : ''}`}
                      title={item.title}
                      onClick={e => { e.stopPropagation(); setSchedulerState({ date: day, blockId: item.id }) }}
                      onContextMenu={e => openMenu(e, item.id, 'Delete all-day item')}
                    >
                      <button
                        type="button"
                        className={`block-done-btn${item.completed ? ' checked' : ''}`}
                        aria-label={`Mark "${item.title}" ${item.completed ? 'incomplete' : 'complete'}`}
                        onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_BLOCK_COMPLETE', id: item.id }) }}
                      >
                        <CheckIcon />
                      </button>
                      <span className="week-allday-title">
                        {flaggedTaskIds.has(item.todoTaskId) && <span className="sched-block-flag">⚑</span>}
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="week-canvas" style={{ height: canvasHeight }}>
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

            <div className="week-columns" ref={columnsRef} style={{ left: BLOCKS_LEFT, height: canvasHeight }}>
              {days.map(day => (
                <div
                  key={day}
                  className={`week-col${day === todayStr ? ' today' : ''}`}
                  onClick={e => handleColumnClick(e, day)}
                >
                  {day === todayStr && nowVisible && (
                    <div className="current-time-line" style={{ top: nowTop }}>
                      <div className="current-time-dot" />
                    </div>
                  )}
                  {layoutBlocks(timedByDay[day]).map(block => (
                    <ScheduledBlock
                      key={block.id}
                      block={block}
                      startOffset={displayStartMinutes}
                      onEdit={id => setSchedulerState({ date: day, blockId: id })}
                      onMenu={(e, id) => openMenu(e, id, 'Delete time block')}
                      flagged={flaggedTaskIds.has(block.todoTaskId)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DndContext>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={menu.label}
          onSelect={() => dispatch({ type: 'DELETE_SCHEDULED_BLOCK', id: menu.id })}
          onClose={closeMenu}
        />
      )}

      {schedulerState && (
        <SchedulerPopup
          date={schedulerState.date}
          blockId={schedulerState.blockId}
          prefill={schedulerState.prefill}
          onClose={() => setSchedulerState(null)}
        />
      )}
    </div>
  )
}
