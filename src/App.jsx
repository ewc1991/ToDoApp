import React, { useEffect } from 'react'
import { useApp } from './store/AppContext.jsx'
import { useAuth } from './store/AuthContext.jsx'
import { isTypingTarget } from './utils/hotkeys.js'
import { useVisualViewport } from './utils/useVisualViewport.js'
import Icon from './components/Icon.jsx'
import Header from './components/Header.jsx'
import CalendarPage from './components/Calendar/CalendarPage.jsx'
import ToDoPage from './components/ToDo/ToDoPage.jsx'
import RecurringPage from './components/Recurring/RecurringPage.jsx'
import NotesPage from './components/Notes/NotesPage.jsx'
import LoginPage from './components/Auth/LoginPage.jsx'

const MOBILE_TABS = [
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'todo', label: 'To Do', icon: 'list' },
  { id: 'recurring', label: 'Recurring', icon: 'repeat' },
  { id: 'notes', label: 'Notes', icon: 'note' },
]

export default function App() {
  const { state, dispatch, networkError } = useApp()
  const { user } = useAuth()
  useVisualViewport()

  useEffect(() => {
    const handler = (e) => {
      if (isTypingTarget(e.target)) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        dispatch({ type: 'UNDO_LAST_COMPLETION' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dispatch])

  if (user === undefined) return <div className="app-loading">Loading…</div>
  if (!user) return <LoginPage />

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        {state.currentPage === 'calendar' && <CalendarPage />}
        {state.currentPage === 'todo' && <ToDoPage />}
        {state.currentPage === 'recurring' && <RecurringPage />}
        {state.currentPage === 'notes' && <NotesPage />}
      </main>
      {networkError && <div className="network-error-toast">{networkError}</div>}
      <nav className="mobile-tabbar">
        {MOBILE_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            data-tab={id}
            aria-current={state.currentPage === id ? 'page' : undefined}
            className={`mobile-tab${state.currentPage === id ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'NAVIGATE_PAGE', page: id })}
          >
            <span className="mobile-tab-icon"><Icon name={icon} size={22} /></span>
            <span className="mobile-tab-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
