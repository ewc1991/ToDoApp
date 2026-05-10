import React, { useEffect } from 'react'
import { useApp } from './store/AppContext.jsx'
import { useAuth } from './store/AuthContext.jsx'
import Header from './components/Header.jsx'
import CalendarPage from './components/Calendar/CalendarPage.jsx'
import ToDoPage from './components/ToDo/ToDoPage.jsx'
import RecurringPage from './components/Recurring/RecurringPage.jsx'
import LoginPage from './components/Auth/LoginPage.jsx'

const CalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const TodoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
)
const RecurIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <polyline points="23 20 23 14 17 14"/>
    <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
  </svg>
)

const MOBILE_TABS = [
  { id: 'calendar', label: 'Calendar', Icon: CalIcon },
  { id: 'todo', label: 'To Do', Icon: TodoIcon },
  { id: 'recurring', label: 'Recurring', Icon: RecurIcon },
]

export default function App() {
  const { state, dispatch } = useApp()
  const { user } = useAuth()

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
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
      </main>
      <nav className="mobile-tabbar">
        {MOBILE_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            data-tab={id}
            className={`mobile-tab${state.currentPage === id ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'NAVIGATE_PAGE', page: id })}
          >
            <span className="mobile-tab-icon"><Icon /></span>
            <span className="mobile-tab-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
