import React, { useState, useEffect, useRef } from 'react'
import ConfirmDialog from './Popups/ConfirmDialog.jsx'
import { useApp } from '../store/AppContext.jsx'
import { useAuth } from '../store/AuthContext.jsx'

const TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'todo', label: 'To Do' },
  { id: 'recurring', label: 'Recurring' },
  { id: 'notes', label: 'Notes' },
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
  const [confirmingRefresh, setConfirmingRefresh] = useState(false)
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

  const unreadNotes = state.notes.filter(n => n.unread).length
  const onNotes = state.currentPage === 'notes'

  // Looking at the Notes page counts as reading whatever arrives while it's open.
  useEffect(() => {
    if (onNotes && unreadNotes > 0) dispatch({ type: 'MARK_NOTES_READ' })
  }, [onNotes, unreadNotes, dispatch])

  // iOS only honours the icon badge once notification permission is granted.
  const [notifPerm, setNotifPerm] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported')
  const canPromptBadge = 'setAppBadge' in navigator && notifPerm === 'default'

  async function enableBadge() {
    setMenuOpen(false)
    try { setNotifPerm(await Notification.requestPermission()) } catch { /* ignore */ }
  }

  // Home-screen icon badge (PWA). Unsupported browsers just skip it.
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return
    const p = unreadNotes > 0 ? navigator.setAppBadge(unreadNotes) : navigator.clearAppBadge()
    p?.catch?.(() => {})
  }, [unreadNotes, notifPerm])

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
            {tab.id === 'notes' && unreadNotes > 0 && (
              <span className="header-tab-badge" aria-label={`${unreadNotes} new notes`}>{unreadNotes}</span>
            )}
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
            {canPromptBadge && (
              <>
                <div className="header-dropdown-divider" />
                <button className="header-dropdown-item" onClick={enableBadge}>
                  Enable app icon badge
                </button>
              </>
            )}
            <div className="header-dropdown-divider" />
            <button
              className="header-dropdown-item"
              onClick={() => { setConfirmingRefresh(true); setMenuOpen(false) }}
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
      {confirmingRefresh && (
        <ConfirmDialog
          title="Refresh app"
          message="Clear the app cache and reload?"
          detail="Your data is safe — this only clears files stored on this device."
          confirmLabel="Refresh"
          onConfirm={hardRefresh}
          onCancel={() => setConfirmingRefresh(false)}
        />
      )}
    </header>
  )
}
