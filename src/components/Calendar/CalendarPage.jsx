import React, { useEffect } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import CalendarView from './CalendarView.jsx'
import DayPlanner from './DayPlanner.jsx'

export default function CalendarPage() {
  const { state, dispatch } = useApp()

  // Generate recurring instances when a date is opened for the first time
  useEffect(() => {
    if (state.currentPlannerDate && !state.generatedDates.includes(state.currentPlannerDate)) {
      dispatch({ type: 'GENERATE_RECURRING_FOR_DATE', dateStr: state.currentPlannerDate })
    }
  }, [state.currentPlannerDate])

  return (
    <div className="calendar-page page">
      {state.currentPlannerDate
        ? <DayPlanner date={state.currentPlannerDate} />
        : <CalendarView />
      }
    </div>
  )
}
