import React, { useState, useEffect, useRef } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const initials = user?.email ? user.email[0].toUpperCase() : '?'

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
      <div className="header-user" ref={menuRef}>
        <button
          className={`header-avatar${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          title={user?.email}
        >
          {initials}
        </button>
        {menuOpen && (
          <div className="header-dropdown">
            {user?.email && (
              <div className="header-dropdown-email">{user.email}</div>
            )}
            <div className="header-dropdown-divider" />
            <button
              className="header-dropdown-item"
              onClick={() => { logOut(); setMenuOpen(false) }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
