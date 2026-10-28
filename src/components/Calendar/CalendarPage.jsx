import React, { useEffect } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { today } from '../../utils/dateUtils.js'
import CalendarView from './CalendarView.jsx'
import DayPlanner from './DayPlanner.jsx'
import WeekPlanner from './WeekPlanner.jsx'
import { useIsMobile } from '../../utils/useMediaQuery.js'

export default function CalendarPage() {
  const { state, dispatch } = useApp()

  // Generate recurring instances when a date is opened for the first time.
  // Wait for recurringTemplatesLoaded so we don't stamp the date as done with an empty template list.
  //
  // Never generate for a past date. Doing so invented history on the spot, and
  // the rollover sweep then moved those freshly created overdue instances onto
  // today — so idly browsing last month deposited tasks on today.
  useEffect(() => {
    const d = state.currentPlannerDate
    if (d && d >= today() && state.recurringTemplatesLoaded && !state.generatedDates.includes(d)) {
      dispatch({ type: 'GENERATE_RECURRING_FOR_DATE', dateStr: d })
    }
  }, [state.currentPlannerDate, state.recurringTemplatesLoaded, state.generatedDates, dispatch])

  // A phone has no room for seven columns, so it keeps the day view even when
  // week was last chosen on a desktop.
  const isMobile = useIsMobile()

  let content = <CalendarView />
  if (state.currentPlannerDate) {
    content = state.plannerView === 'week' && !isMobile
      ? <WeekPlanner date={state.currentPlannerDate} />
      : <DayPlanner date={state.currentPlannerDate} />
  }

  return <div className="calendar-page page">{content}</div>
}
