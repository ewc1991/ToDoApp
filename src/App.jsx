import React, { useEffect } from 'react'
import { useApp } from './store/AppContext.jsx'
import { useAuth } from './store/AuthContext.jsx'
import Header from './components/Header.jsx'
import CalendarPage from './components/Calendar/CalendarPage.jsx'
import ToDoPage from './components/ToDo/ToDoPage.jsx'
import RecurringPage from './components/Recurring/RecurringPage.jsx'
import LoginPage from './components/Auth/LoginPage.jsx'

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
    </div>
  )
}
