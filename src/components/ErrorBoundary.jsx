import React from 'react'

async function clearCachesAndReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch {
    // Best effort — reload regardless.
  }
  window.location.reload()
}

// Without this, a single bad record (or any render throw) blanks the whole PWA
// with no way back other than clearing site data by hand.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <div className="error-boundary-icon">⚠</div>
          <h1 className="error-boundary-title">Something went wrong</h1>
          <p className="error-boundary-text">
            The app hit an unexpected error. Your data is saved — reloading usually fixes it.
          </p>
          <div className="error-boundary-actions">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button className="btn btn-secondary" onClick={clearCachesAndReload}>
              Clear Cache &amp; Reload
            </button>
          </div>
          <details className="error-boundary-details">
            <summary>Technical details</summary>
            <pre>{String(this.state.error?.stack || this.state.error)}</pre>
          </details>
        </div>
      </div>
    )
  }
}
