import React from 'react'
import { useApp } from '../store/AppContext.jsx'

const TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'todo', label: 'To Do' },
  { id: 'recurring', label: 'Recurring' },
]

export default function Header() {
  const { state, dispatch } = useApp()

  return (
    <header className="header">
      <span className="header-brand">Planner</span>
      <nav className="header-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`header-tab${state.currentPage === tab.id ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'NAVIGATE_PAGE', page: tab.id })}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
