import React from 'react'
import { useApp } from '../store/AppContext.jsx'
import { useAuth } from '../store/AuthContext.jsx'

const TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'todo', label: 'To Do' },
  { id: 'recurring', label: 'Recurring' },
]

export default function Header() {
  const { state, dispatch } = useApp()
  const { user, logOut } = useAuth()

  return (
    <header className="header">
      <span className="header-brand">Planner</span>
      <nav className="header-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            data-tab={tab.id}
            className={`header-tab${state.currentPage === tab.id ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'NAVIGATE_PAGE', page: tab.id })}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="header-user">
        {user?.email && <span className="header-email">{user.email}</span>}
        <button className="header-signout" onClick={logOut}>Sign out</button>
      </div>
    </header>
  )
}
