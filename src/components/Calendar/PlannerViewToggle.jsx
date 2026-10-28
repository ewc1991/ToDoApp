import React from 'react'
import { useApp } from '../../store/AppContext.jsx'

const VIEWS = [
  { id: 'day',  label: 'Day' },
  { id: 'week', label: 'Week' },
]

// Desktop only — the week grid needs room for seven columns side by side.
export default function PlannerViewToggle() {
  const { state, dispatch } = useApp()
  return (
    <div className="planner-view-toggle" role="group" aria-label="Planner view">
      {VIEWS.map(v => (
        <button
          key={v.id}
          type="button"
          aria-pressed={state.plannerView === v.id}
          className={state.plannerView === v.id ? 'active' : ''}
          onClick={() => dispatch({ type: 'SET_PLANNER_VIEW', view: v.id })}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}
