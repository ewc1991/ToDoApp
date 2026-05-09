import React from 'react'
import { useApp } from '../../store/AppContext.jsx'
import {
  MONTH_NAMES, DAY_NAMES,
  getDaysInMonth, getFirstDayOfMonth, makeDateStr, isToday, today
} from '../../utils/dateUtils.js'

export default function CalendarView() {
  const { state, dispatch } = useApp()
  const { calendarMonth: month, calendarYear: year } = state

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  // Previous month fill
  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const prevDays = getDaysInMonth(prevYear, prevMonth)

  // Task indicators per date
  const taskDateSet = new Set()
  state.tasks.forEach(t => { if (t.assignedDate) taskDateSet.add(t.assignedDate) })
  state.scheduledBlocks.forEach(b => taskDateSet.add(b.date))

  const cells = []

  // Leading cells from previous month
  for (let i = 0; i < firstDay; i++) {
    const day = prevDays - firstDay + 1 + i
    cells.push({ day, dateStr: makeDateStr(prevYear, prevMonth + 1, day), currentMonth: false })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: makeDateStr(year, month + 1, d), currentMonth: true })
  }

  // Trailing cells for next month
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year
  const totalCells = Math.ceil(cells.length / 7) * 7
  for (let d = 1; cells.length < totalCells; d++) {
    cells.push({ day: d, dateStr: makeDateStr(nextYear, nextMonth + 1, d), currentMonth: false })
  }

  const todayStr = today()

  const YEARS = []
  for (let y = year - 5; y <= year + 10; y++) YEARS.push(y)

  return (
    <div className="calendar-view">
      <div className="calendar-nav">
        <div className="calendar-nav-arrows">
          <button className="icon-btn" onClick={() => dispatch({ type: 'NAVIGATE_MONTH', dir: 'prev' })}>‹</button>
          <button className="icon-btn" onClick={() => dispatch({ type: 'NAVIGATE_MONTH', dir: 'next' })}>›</button>
        </div>
        <span className="calendar-month-year">{MONTH_NAMES[month]} {year}</span>
        <div className="calendar-selects">
          <select
            className="calendar-select"
            value={month}
            onChange={e => dispatch({ type: 'SET_MONTH_YEAR', month: Number(e.target.value), year })}
          >
            {MONTH_NAMES.map((mn, i) => <option key={i} value={i}>{mn}</option>)}
          </select>
          <select
            className="calendar-select"
            value={year}
            onChange={e => dispatch({ type: 'SET_MONTH_YEAR', month, year: Number(e.target.value) })}
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {(month !== new Date().getMonth() || year !== new Date().getFullYear()) && (
          <button
            className="icon-btn"
            title="Go to today"
            onClick={() => dispatch({ type: 'SET_MONTH_YEAR', month: new Date().getMonth(), year: new Date().getFullYear() })}
            style={{ fontSize: 12, width: 'auto', padding: '0 8px' }}
          >
            Today
          </button>
        )}
      </div>

      <div className="calendar-grid-header">
        {DAY_NAMES.map(d => <div key={d} className="calendar-day-name">{d}</div>)}
      </div>

      <div className="calendar-grid">
        {cells.map((cell, i) => {
          const hasTasks = taskDateSet.has(cell.dateStr)
          const selected = cell.dateStr === state.currentPlannerDate
          const isCurrentDay = isToday(cell.dateStr)
          return (
            <div
              key={i}
              className={[
                'calendar-cell',
                !cell.currentMonth ? 'other-month' : '',
                isCurrentDay && !selected ? 'today' : '',
                selected ? 'selected' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => cell.currentMonth && dispatch({ type: 'NAVIGATE_DATE', dateStr: cell.dateStr })}
            >
              <span className="calendar-date">{cell.day}</span>
              {hasTasks && cell.currentMonth && (
                <div className="calendar-dot-row"><div className="calendar-dot" /></div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
