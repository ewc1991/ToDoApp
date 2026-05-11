import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { useAuth } from '../store/AuthContext.jsx'

const TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'todo', label: 'To Do' },
  { id: 'recurring', label: 'Recurring' },
]

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  return now
}

function formatClock(date) {
  const mm   = String(date.getMonth() + 1).padStart(2, '0')
  const dd   = String(date.getDate()).padStart(2, '0')
  const yy   = String(date.getFullYear()).slice(2)
  const h    = date.getHours()
  const min  = String(date.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return { date: `${mm}/${dd}/${yy}`, time: `${h12}:${min} ${ampm}` }
}

async function hardRefresh() {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map(r => r.unregister()))
  }
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map(k => caches.delete(k)))
  }
  window.location.reload()
}

export default function Header() {
  const { state, dispatch } = useApp()
  const { user, logOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const now = useNow()
  const clock = formatClock(now)

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
        <div className="header-clock">
          <span className="header-clock-date">{clock.date}</span>
          <span className="header-clock-time">{clock.time}</span>
        </div>
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
              onClick={hardRefresh}
            >
              Refresh App
            </button>
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
